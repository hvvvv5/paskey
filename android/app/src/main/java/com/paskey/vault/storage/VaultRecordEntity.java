package com.paskey.vault.storage;

import androidx.annotation.NonNull;
import androidx.room.Entity;

@Entity(tableName = "vault_records", primaryKeys = {"entity", "recordId"})
public class VaultRecordEntity {
    @NonNull public String entity;
    @NonNull public String recordId;
    @NonNull public String ciphertext;
    @NonNull public String iv;

    public VaultRecordEntity(@NonNull String entity, @NonNull String recordId,
                             @NonNull String ciphertext, @NonNull String iv) {
        this.entity = entity;
        this.recordId = recordId;
        this.ciphertext = ciphertext;
        this.iv = iv;
    }
}
