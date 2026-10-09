package com.offlineknowledge.app.data

import android.content.Context
import androidx.room.*
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import org.json.JSONArray

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
    val doNotConfuseTerm: String? = null,
    val doNotConfuseDifference: String? = null,
    val formulasJson: String? = null,
    val conversionsJson: String? = null,
    val source: String = "Справочник точных наук",
    val keywordsJson: String
)

@Entity(tableName = "query_history")
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
    @Query("SELECT * FROM knowledge_entries WHERE canonicalTitle LIKE '%' || :query || '%' OR keywordsJson LIKE '%' || :query || '%' LIMIT 10")
    suspend fun search(query: String): List<KnowledgeEntity>

    @Query("SELECT * FROM knowledge_entries WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): KnowledgeEntity?

    @Query("SELECT * FROM knowledge_entries ORDER BY categoryRu ASC, canonicalTitle ASC")
    fun getAllFlow(): Flow<List<KnowledgeEntity>>

    @Query("SELECT * FROM knowledge_entries WHERE category = :category ORDER BY canonicalTitle ASC")
    fun getByCategoryFlow(category: String): Flow<List<KnowledgeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<KnowledgeEntity>)
}

@Dao
interface HistoryDao {
    @Query("SELECT * FROM query_history ORDER BY timestamp DESC")
    fun getAllHistoryFlow(): Flow<List<HistoryEntity>>

    @Query("SELECT * FROM query_history WHERE isFavorite = 1 ORDER BY timestamp DESC")
    fun getFavoritesFlow(): Flow<List<HistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: HistoryEntity)

    @Query("UPDATE query_history SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun setFavorite(id: String, isFavorite: Boolean)

    @Query("DELETE FROM query_history WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM query_history")
    suspend fun clearAll()
}

@Database(entities = [KnowledgeEntity::class, HistoryEntity::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun knowledgeDao(): KnowledgeDao
    abstract fun historyDao(): HistoryDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "offline_mind.db"
                )
                .fallbackToDestructiveMigration()
                .addCallback(object : Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        CoroutineScope(Dispatchers.IO).launch {
                            INSTANCE?.knowledgeDao()?.insertAll(DEFAULT_KNOWLEDGE_ENTRIES)
                        }
                    }
                })
                .build().also { INSTANCE = it }
            }
        }
    }
}

val DEFAULT_KNOWLEDGE_ENTRIES = listOf(
    KnowledgeEntity(
        id = "decimeter",
        canonicalTitle = "Дециметр",
        category = "units_length",
        categoryRu = "Единицы длины",
        definition = "Дециметр (дм) — дольная единица измерения длины в Международной системе единиц (СИ), равная 1/10 доле метра или 10 сантиметрам.",
        simpleExplanation = "В одном дециметре ровно 10 сантиметров или 0,1 метра. В одном метре содержится ровно 10 дециметров.",
        examplesJson = "[\"Длина школьной линейки 20 см — это 2 дм\", \"Ширина тетради около 1,7 дм\"]",
        relatedConceptsJson = "[\"Метр\", \"Сантиметр\", \"Миллиметр\"]",
        doNotConfuseTerm = "Декаметр",
        doNotConfuseDifference = "Дециметр (дм) — это 0,1 метра (дольная), а декаметр (дам) — это 10 метров (кратная единица).",
        formulasJson = "[\"1 дм = 0,1 м\", \"1 дм = 10 см = 100 мм\", \"1 м = 10 дм\"]",
        conversionsJson = "[\"1 дм = 0.1 м\", \"1 дм = 10 см\", \"1 дм = 100 мм\"]",
        keywordsJson = "[\"дециметр\", \"дм\", \"сантиметр\", \"метр\", \"длина\", \"сколько см в дециметре\"]"
    ),
    KnowledgeEntity(
        id = "area_vs_perimeter",
        canonicalTitle = "Площадь и Периметр",
        category = "geometry",
        categoryRu = "Геометрия",
        definition = "Периметр — это суммарная длина границы замкнутой плоской фигуры (одномерная величина). Площадь — это мера величины двумерной поверхности, ограниченной этой фигурой.",
        simpleExplanation = "Периметр — это длина забора вокруг участка (в метрах). Площадь — это размер самого газона внутри забора (в квадратных метрах).",
        examplesJson = "[\"У прямоугольника 3×4 м: периметр = 2×(3+4) = 14 м, площадь = 3×4 = 12 кв. м\"]",
        relatedConceptsJson = "[\"Прямоугольник\", \"Квадрат\", \"Квадратный метр\"]",
        doNotConfuseTerm = "Периметр и Площадь",
        doNotConfuseDifference = "Периметр измеряется в линейных единицах (м, см), а площадь — в квадратных (кв. м, га, сотки). У фигур с одинаковым периметром могут быть разные площади.",
        formulasJson = "[\"Периметр прямоугольника: P = 2·(a + b)\", \"Площадь прямоугольника: S = a · b\", \"Периметр квадрата: P = 4·a\", \"Площадь квадрата: S = a²\"]",
        conversionsJson = "[]",
        keywordsJson = "[\"площадь\", \"периметр\", \"геометрия\", \"разница\", \"чем отличается площадь от периметра\", \"формула\"]"
    ),
    KnowledgeEntity(
        id = "sotka",
        canonicalTitle = "Сотка (Ар)",
        category = "units_area",
        categoryRu = "Единицы площади",
        definition = "Сотка (внесистемное название ара) — единица измерения площади земельных участков, равная 100 квадратным метрам (квадрат 10×10 метров).",
        simpleExplanation = "Одна сотка — это ровно 100 квадратных метров. В одном гектаре содержится 100 соток.",
        examplesJson = "[\"Дачный участок 6 соток = 600 кв. метров\", \"Участок 10 соток = 1000 кв. метров\"]",
        relatedConceptsJson = "[\"Гектар\", \"Ар\", \"Квадратный метр\", \"Акр\"]",
        doNotConfuseTerm = "Гектар",
        doNotConfuseDifference = "Сотка — 100 кв. м, а гектар — 10 000 кв. м (ровно 100 соток).",
        formulasJson = "[\"1 сотка = 100 м²\", \"1 га = 100 соток = 10 000 м²\"]",
        conversionsJson = "[\"1 сотка = 100 м²\", \"100 соток = 1 га\"]",
        keywordsJson = "[\"сотка\", \"ар\", \"сколько метров в сотке\", \"площадь земли\", \"дачный участок\"]"
    ),
    KnowledgeEntity(
        id = "hectare_vs_acre",
        canonicalTitle = "Гектар и Акр",
        category = "units_area",
        categoryRu = "Единицы площади",
        definition = "Гектар (га) — метрическая единица площади, равная 10 000 м² (100 соток). Акр — традиционная англо-американская единица площади, равная приблизительно 4 046,86 м².",
        simpleExplanation = "Гектар значительно больше акра. В 1 гектаре содержится примерно 2,47 акра. 1 акр — это примерно 40,5 соток.",
        examplesJson = "[\"Футбольное поле занимает около 0,7 гектара\", \"Поле 10 га = 100 000 кв. м\"]",
        relatedConceptsJson = "[\"Сотка\", \"Квадратный метр\", \"Ар\"]",
        doNotConfuseTerm = "Акр и Гектар",
        doNotConfuseDifference = "1 га = 10 000 м² (метрическая система), 1 акр ≈ 4 047 м² (английская система). 1 га ≈ 2,47 акра.",
        formulasJson = "[\"1 га = 10 000 м² = 100 соток\", \"1 акр ≈ 4 046,86 м² ≈ 40,47 сотки\"]",
        conversionsJson = "[\"1 га = 10 000 м²\", \"1 акр = 4046.86 м²\", \"1 га = 2.471 акра\"]",
        keywordsJson = "[\"гектар\", \"акр\", \"чем отличается акр от гектара\", \"сколько в гектаре\", \"сотки\"]"
    ),
    KnowledgeEntity(
        id = "division_components",
        canonicalTitle = "Компоненты деления",
        category = "arithmetic",
        categoryRu = "Арифметика",
        definition = "При делении число, которое делят, называется делимым. Число, на которое делят, называется делителем. Результат деления называется частным.",
        simpleExplanation = "Делимое : Делитель = Частное. То, что делим — делимое; на сколько частей делим — делитель; сколько получилось в каждой части — частное.",
        examplesJson = "[\"В примере 20 : 4 = 5: 20 — делимое, 4 — делитель, 5 — частное\"]",
        relatedConceptsJson = "[\"Умножение\", \"Остаток\", \"Дробь\"]",
        doNotConfuseTerm = "Делимое и Делитель",
        doNotConfuseDifference = "Делимое стоит первым (его уменьшают делением), делитель стоит вторым (он задаёт размер долей). На 0 делить нельзя.",
        formulasJson = "[\"Делимое = Делитель × Частное + Остаток\"]",
        conversionsJson = "[]",
        keywordsJson = "[\"делимое\", \"делитель\", \"частное\", \"как называется число которое делят\", \"деление\", \"компоненты\"]"
    ),
    KnowledgeEntity(
        id = "multiplication_components",
        canonicalTitle = "Компоненты умножения",
        category = "arithmetic",
        categoryRu = "Арифметика",
        definition = "Числа, которые перемножаются, называются множителями (первый множитель, второй множитель). Результат умножения называется произведением.",
        simpleExplanation = "Множитель × Множитель = Произведение. От перемены мест множителей произведение не меняется (переместительный закон).",
        examplesJson = "[\"В примере 6 × 7 = 42: 6 и 7 — множители, 42 — произведение\"]",
        relatedConceptsJson = "[\"Сложение\", \"Деление\", \"Степени\"]",
        doNotConfuseTerm = "Множитель и Произведение",
        doNotConfuseDifference = "Множители — исходные числа, произведение — итоговый результат умножения.",
        formulasJson = "[\"a × b = c (a, b — множители, c — произведение)\"]",
        conversionsJson = "[]",
        keywordsJson = "[\"множитель\", \"произведение\", \"умножение\", \"как называется результат умножения\"]"
    ),
    KnowledgeEntity(
        id = "density",
        canonicalTitle = "Плотность вещества",
        category = "physics",
        categoryRu = "Физика",
        definition = "Плотность — скалярная физическая величина, определяемая как отношение массы тела к занимаемому им объёму. Обозначается греческой буквой ρ (ро).",
        simpleExplanation = "Показывает, сколько килограммов весит один кубический метр вещества. Плотность воды равна ровно 1000 кг/м³ (или 1 г/см³).",
        examplesJson = "[\"Плотность воды: 1000 кг/м³\", \"Плотность железа: 7800 кг/м³\", \"Плотность золота: 19300 кг/м³\"]",
        relatedConceptsJson = "[\"Масса\", \"Объём\", \"Закон Архимеда\"]",
        doNotConfuseTerm = "Плотность и Вес",
        doNotConfuseDifference = "Плотность — внутреннее свойство вещества (кг/м³), а вес — сила, с которой тело давит на опору из-за гравитации (в Ньютонах).",
        formulasJson = "[\"ρ = m / V\", \"m = ρ · V\", \"V = m / ρ\"]",
        conversionsJson = "[\"1 г/см³ = 1000 кг/м³\"]",
        keywordsJson = "[\"плотность\", \"масса\", \"объем\", \"ро\", \"формула плотности\", \"плотность воды\"]"
    )
)
