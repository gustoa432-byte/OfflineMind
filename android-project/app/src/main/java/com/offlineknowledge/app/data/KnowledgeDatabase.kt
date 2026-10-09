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

@Dao
interface KnowledgeDao {
    @Query("SELECT * FROM knowledge_entries WHERE canonicalTitle LIKE '%' || :query || '%' OR keywordsJson LIKE '%' || :query || '%'")
    suspend fun search(query: String): List<KnowledgeEntity>

    @Query("SELECT * FROM knowledge_entries WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): KnowledgeEntity?

    @Query("SELECT * FROM knowledge_entries ORDER BY canonicalTitle ASC")
    fun getAllFlow(): Flow<List<KnowledgeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<KnowledgeEntity>)
}

@Database(entities = [KnowledgeEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun knowledgeDao(): KnowledgeDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "offline_knowledge.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
