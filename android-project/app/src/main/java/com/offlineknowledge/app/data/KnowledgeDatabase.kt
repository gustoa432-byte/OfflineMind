package com.offlineknowledge.app.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "knowledge_entries")
data class KnowledgeEntity(
    @PrimaryKey val id: String,
    val canonicalTitle: String,
    val category: String,
    val categoryRu: String,
    val definition: String,
    val simpleExplanation: String,
    val examplesJson: String,
    val relatedConceptsJson: String,
    val doNotConfuseTerm: String?,
    val doNotConfuseDifference: String?,
    val formulasJson: String?,
    val source: String,
    val keywordsJson: String
)

@Entity(tableName = "knowledge_chunks")
data class KnowledgeChunkEntity(
    @PrimaryKey val id: String,
    val title: String,
    val source: String,
    val grade: String,
    val text: String
)

@Entity(tableName = "history_entries")
data class HistoryEntity(
    @PrimaryKey val id: String,
    val timestamp: Long,
    val query: String,
    val answerText: String,
    val matchedEntryTitle: String?,
    val ttftMs: Long,
    val totalTimeMs: Long,
    val tokensGenerated: Int,
    val tokensPerSec: Double,
    val memoryRssMb: Int,
    val isFavorite: Boolean = false
)

@Dao
interface KnowledgeDao {
    @Query("SELECT * FROM knowledge_entries")
    suspend fun getAllEntries(): List<KnowledgeEntity>

    @Query("SELECT * FROM knowledge_entries WHERE canonicalTitle LIKE '%' || :query || '%' OR keywordsJson LIKE '%' || :query || '%'")
    suspend fun search(query: String): List<KnowledgeEntity>

    @Query("SELECT * FROM knowledge_entries WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): KnowledgeEntity?

    @Query("SELECT * FROM knowledge_entries ORDER BY canonicalTitle ASC")
    fun getAllFlow(): Flow<List<KnowledgeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<KnowledgeEntity>)

    @Query("DELETE FROM knowledge_entries")
    suspend fun clearEntries()
}

@Dao
interface KnowledgeChunkDao {
    @Query("SELECT * FROM knowledge_chunks")
    suspend fun getAllChunks(): List<KnowledgeChunkEntity>

    @Query("SELECT * FROM knowledge_chunks WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): KnowledgeChunkEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(chunks: List<KnowledgeChunkEntity>)

    @Query("DELETE FROM knowledge_chunks")
    suspend fun clearChunks()
}

@Dao
interface HistoryDao {
    @Query("SELECT * FROM history_entries ORDER BY timestamp DESC")
    fun getAllHistoryFlow(): Flow<List<HistoryEntity>>

    @Query("SELECT * FROM history_entries WHERE isFavorite = 1 ORDER BY timestamp DESC")
    fun getFavoritesFlow(): Flow<List<HistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(history: HistoryEntity)

    @Query("UPDATE history_entries SET isFavorite = :isFav WHERE id = :id")
    suspend fun setFavorite(id: String, isFav: Boolean)

    @Query("DELETE FROM history_entries WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM history_entries")
    suspend fun clearAll()
}

@Database(
    entities = [
        KnowledgeEntity::class,
        KnowledgeChunkEntity::class,
        HistoryEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun knowledgeDao(): KnowledgeDao
    abstract fun knowledgeChunkDao(): KnowledgeChunkDao
    abstract fun historyDao(): HistoryDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "offline_knowledge.db"
                )
                .fallbackToDestructiveMigration()
                .build().also { INSTANCE = it }
            }
        }
    }
}
