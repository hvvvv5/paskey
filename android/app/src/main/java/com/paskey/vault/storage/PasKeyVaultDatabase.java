package com.paskey.vault.storage;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

@Database(entities = {VaultRecordEntity.class}, version = 1, exportSchema = false)
public abstract class PasKeyVaultDatabase extends RoomDatabase {
    public abstract VaultRecordDao records();

    private static volatile PasKeyVaultDatabase INSTANCE;

    public static PasKeyVaultDatabase get(Context context) {
        PasKeyVaultDatabase current = INSTANCE;
        if (current != null) return current;
        synchronized (PasKeyVaultDatabase.class) {
            if (INSTANCE == null) {
                INSTANCE = Room.databaseBuilder(
                        context.getApplicationContext(),
                        PasKeyVaultDatabase.class,
                        "paskey-vault.db"
                ).build();
            }
            return INSTANCE;
        }
    }
}
