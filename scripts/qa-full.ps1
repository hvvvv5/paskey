$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$ReportDir = Join-Path $Root 'qa-report'
$ReportPath = Join-Path $ReportDir 'latest.txt'
$ApkPath = Join-Path $Root 'android\app\build\outputs\apk\debug\app-debug.apk'
$Package = 'com.paskey.vault'

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$lines = [System.Collections.Generic.List[string]]::new()

function Add-Result([string]$Name, [string]$State, [string]$Detail = '') {
    $line = ('{0,-34} {1,-6} {2}' -f $Name, $State, $Detail).TrimEnd()
    $lines.Add($line) | Out-Null
    Write-Host $line
}

function Run-Step([string]$Name, [scriptblock]$Action) {
    try {
        & $Action | Out-Host
        $exitCode = $LASTEXITCODE
        if ($null -ne $exitCode -and $exitCode -ne 0) { throw "$Name exited with code $exitCode" }
        Add-Result $Name 'PASS'
        return [bool]$true
    } catch {
        Add-Result $Name 'FAIL' $_.Exception.Message
        return [bool]$false
    }
}

Push-Location $Root
try {
    Add-Result 'PasKey automated QA' 'START' (Get-Date -Format o)

    if (-not (Run-Step 'npm lint' { npm run lint })) { throw 'Web lint failed' }
    if (-not (Run-Step 'TypeScript check' { npm run typecheck })) { throw 'Typecheck failed' }
    if (-not (Run-Step 'Node tests + limits' { npm test })) { throw 'Tests failed' }
    if (-not (Run-Step 'Vite production build' { npm run build })) { throw 'Web build failed' }
    if (-not (Run-Step 'Capacitor Android sync' { npx cap sync android })) { throw 'Capacitor sync failed' }

    Push-Location (Join-Path $Root 'android')
    try {
        if (-not (Run-Step 'Android unit tests' { .\gradlew testDebugUnitTest })) { throw 'Android unit tests failed' }
        if (-not (Run-Step 'Android debug APK' { .\gradlew assembleDebug })) { throw 'Android build failed' }
    } finally {
        Pop-Location
    }

    if (Test-Path $ApkPath) {
        $hash = (Get-FileHash -Algorithm SHA256 $ApkPath).Hash
        $size = [math]::Round((Get-Item $ApkPath).Length / 1MB, 2)
        Add-Result 'APK artifact' 'PASS' "$size MB · SHA256 $hash"
    } else {
        throw "APK not found: $ApkPath"
    }

    $adb = Get-Command adb -ErrorAction SilentlyContinue
    if (-not $adb) {
        Add-Result 'ADB device smoke test' 'SKIP' 'adb is not available'
    } else {
        $device = (& adb devices) | Select-String -Pattern '^([^\s]+)\s+device$' | Select-Object -First 1
        if (-not $device) {
            Add-Result 'ADB device smoke test' 'SKIP' 'No authorized Android device connected'
        } else {
            $serial = $device.Matches[0].Groups[1].Value
            Add-Result 'Android device' 'PASS' $serial

            if (-not (Run-Step 'Install APK preserving data' { adb -s $serial install -r $ApkPath })) { throw 'APK installation failed' }

            Run-Step 'Launch PasKey' {
                adb -s $serial shell am force-stop $Package | Out-Null
                adb -s $serial shell monkey -p $Package 1 | Out-Null
                Start-Sleep -Seconds 2
            } | Out-Null

            try {
                $focus = (adb -s $serial shell dumpsys window | Select-String -Pattern 'mCurrentFocus|mFocusedApp|topResumedActivity' | Select-Object -First 5) -join ' '
                if ($focus -match [regex]::Escape($Package)) {
                    Add-Result 'Foreground activity' 'PASS' 'PasKey is visible'
                } else {
                    Add-Result 'Foreground activity' 'WARN' ($focus.Trim())
                }
            } catch { Add-Result 'Foreground activity' 'WARN' $_.Exception.Message }

            try {
                $autofill = (adb -s $serial shell settings get secure autofill_service 2>$null).Trim()
                if ($autofill -match [regex]::Escape($Package)) {
                    Add-Result 'Android Autofill service' 'PASS' $autofill
                } elseif ([string]::IsNullOrWhiteSpace($autofill) -or $autofill -eq 'null') {
                    Add-Result 'Android Autofill service' 'WARN' 'No Autofill service is currently selected'
                } else {
                    Add-Result 'Android Autofill service' 'WARN' $autofill
                }
            } catch { Add-Result 'Android Autofill service' 'WARN' $_.Exception.Message }

            try {
                $processId = (adb -s $serial shell pidof $Package 2>$null).Trim()
                if ($processId) { Add-Result 'PasKey process' 'PASS' "PID $processId" }
                else { Add-Result 'PasKey process' 'WARN' 'Process not found after launch' }
            } catch { Add-Result 'PasKey process' 'WARN' $_.Exception.Message }

            try {
                $crashes = adb -s $serial logcat -d -t 400 2>$null | Select-String -Pattern 'FATAL EXCEPTION|AndroidRuntime.*com\.paskey\.vault|Process: com\.paskey\.vault'
                if ($crashes) {
                    $detail = (($crashes | Select-Object -First 3) -join ' | ')
                    Add-Result 'Recent crash scan' 'FAIL' $detail
                    throw "Recent PasKey crash detected"
                }
                Add-Result 'Recent crash scan' 'PASS'
            } catch {
                if ($_.Exception.Message -eq 'Recent PasKey crash detected') { throw }
                Add-Result 'Recent crash scan' 'WARN' $_.Exception.Message
            }
        }
    }

    Add-Result 'QA result' 'PASS' 'All mandatory automated checks passed'
} catch {
    Add-Result 'QA result' 'FAIL' $_.Exception.Message
    $lines | Set-Content -Encoding UTF8 $ReportPath
    Write-Host ''
    Write-Host "Report: $ReportPath"
    Pop-Location
    exit 1
}

$lines | Set-Content -Encoding UTF8 $ReportPath
Write-Host ''
Write-Host "Report: $ReportPath"
Pop-Location
exit 0