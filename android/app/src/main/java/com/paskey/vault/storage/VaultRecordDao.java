package com.paskey.vault.storage;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.List;

@Dao
public interface VaultRecordDao {
    @Query("SELECT * FROM vault_records WHERE entity = :entity ORDER BY recordId")
    List<VaultRecordEntity> findByEntity(String entity);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void upsertAll(List<VaultRecordEntity> records);

    @Query("DELETE FROM vault_records WHERE entity = :entity")
    void deleteEntity(String entity);

    @Query("DELETE FROM vault_records")
    void deleteAll();
}
