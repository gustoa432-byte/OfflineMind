package com.offlineknowledge.app.engine

import com.offlineknowledge.app.data.KnowledgeChunkEntity
import com.offlineknowledge.app.data.KnowledgeEntity
import org.json.JSONArray

data class EntryMatch(
    val entry: KnowledgeEntity,
    val score: Int,
    val matchType: String
)

data class ChunkMatch(
    val chunk: KnowledgeChunkEntity,
    val score: Int
)

sealed class KnowledgeSearchResult {
    data class EntryFound(val entry: KnowledgeEntity, val score: Int) : KnowledgeSearchResult()
    data class ChunkFound(val chunk: KnowledgeChunkEntity, val score: Int) : KnowledgeSearchResult()
    object NotFound : KnowledgeSearchResult()
}

object OfflineKnowledgeSearchEngine {

    // Synonym mappings ported directly from knowledgeEngine.ts
    private val INTENT_SYNONYMS: Map<String, List<String>> = mapOf(
        "area_vs_perimeter" to listOf(
            "площадь", "периметр", "забор", "трава", "разница площадь периметр",
            "чем отличается площадь", "чем отличается периметр", "периметр и площадь разница",
            "квадратные метры и метры"
        ),
        "meter_vs_decimeter" to listOf(
            "дециметр", "дм", "дециметре", "метре", "сколько метров в дециметре",
            "сколько сантиметров в дециметре", "метр дециметр", "1 дм"
        ),
        "sotka_ar" to listOf(
            "сотка", "сотке", "сотки", "сотка земли", "ар", "что такое сотка",
            "сколько в сотке", "сколько квадратных метров в сотке", "100 метров"
        ),
        "acre_vs_hectare" to listOf(
            "акр", "гектар", "акре", "гектаре", "чем акр отличается от гектара",
            "акр или гектар", "что больше акр или гектар", "соток в гектаре", "соток в акре"
        ),
        "dividend_divisor_quotient" to listOf(
            "число которое делят", "число на которое делят", "делимое", "делитель",
            "частное", "как называется число которое делят", "компоненты деления", "деление"
        ),
        "subtraction_components" to listOf(
            "уменьшаемое", "вычитаемое", "разность", "число из которого вычитают",
            "число которое вычитают", "минус", "компоненты вычитания"
        ),
        "multiplication_components" to listOf(
            "множитель", "произведение", "результат умножения", "числа которые умножают",
            "умножение"
        ),
        "addition_components" to listOf(
            "слагаемое", "сумма", "результат сложения", "числа которые складывают", "плюс"
        ),
        "radius_vs_diameter" to listOf(
            "радиус", "диаметр", "круг", "окружность", "центр круга", "половина диаметра"
        ),
        "hypotenuse_vs_leg" to listOf(
            "гипотенуза", "катет", "катеты", "сторона прямоугольного треугольника",
            "прямой угол", "теорема пифагора", "самая длинная сторона"
        ),
        "volume_vs_area" to listOf(
            "объем", "площадь и объем", "кубические метры", "разница объем площадь"
        ),
        "liter_cubic_meter" to listOf(
            "литр", "кубический метр", "куб воды", "сколько литров в кубе", "дм3"
        ),
        "mass_vs_weight" to listOf(
            "масса", "вес", "чем масса отличается от веса", "луна", "невесомость", "ньютон", "кг"
        ),
        "mass_units_metric" to listOf(
            "центнер", "тонна", "грамм", "килограмм", "сколько в центнере кг", "сколько в тонне"
        ),
        "old_russian_units" to listOf(
            "пуд", "сажень", "аршин", "вершок", "сколько в пуде", "пуд соли"
        ),
        "speed_vs_acceleration" to listOf(
            "скорость", "ускорение", "чем скорость отличается от ускорения", "разгон"
        ),
        "anglo_length_units" to listOf(
            "дюйм", "фут", "ярд", "миля", "сколько см в дюйме", "дюймы"
        ),
        "percent_vs_promille" to listOf(
            "процент", "промилле", "сотая часть", "тысячная часть"
        ),
        "fractions_common" to listOf(
            "дробь", "обыкновенная дробь", "числитель", "знаменатель", "сложение дробей", "деление дробей"
        ),
        "fractions_decimal" to listOf(
            "десятичная дробь", "десятые доли", "сотые доли", "запятая в дроби"
        ),
        "percentages" to listOf(
            "процент", "проценты", "как посчитать процент", "скидка", "процент от числа"
        ),
        "gcd_lcm" to listOf(
            "нод", "нок", "наибольший общий делитель", "наименьшее общее кратное"
        ),
        "prime_composite_numbers" to listOf(
            "простые числа", "составные числа", "простое число", "таблица простых чисел"
        ),
        "proportions_rule" to listOf(
            "пропорция", "основное свойство пропорции", "правило креста", "члены пропорции"
        ),
        "divisibility_rules" to listOf(
            "признаки делимости", "делимость на 3", "делимость на 9", "делимость на 4"
        ),
        "powers_properties" to listOf(
            "свойства степеней", "степени", "показатель степени", "отрицательная степень"
        ),
        "abbreviated_multiplication_all" to listOf(
            "фсу", "формулы сокращенного умножения", "квадрат суммы", "квадрат разности", "разность квадратов", "куб суммы"
        ),
        "quadratic_equation_discriminant" to listOf(
            "дискриминант", "квадратное уравнение", "формула корней", "b2 4ac"
        ),
        "vieta_theorem" to listOf(
            "теорема виета", "виет", "корни по виету", "сумма и произведение корней"
        ),
        "intervals_method" to listOf(
            "метод интервалов", "неравенство", "решение неравенств", "знаки на интервалах"
        ),
        "pythagorean_theorem_full" to listOf(
            "теорема пифагора", "пифагор", "египетский треугольник", "квадрат гипотенузы"
        ),
        "law_of_cosines" to listOf(
            "теорема косинусов", "косинус угла треугольника", "сторона через косинус"
        ),
        "law_of_sines" to listOf(
            "теорема синусов", "радиус описанной окружности r", "2r теорема синусов"
        ),
        "triangle_area_all_formulas" to listOf(
            "площадь треугольника", "формула герона", "герон", "площадь через основание и высоту"
        ),
        "quadrilaterals_areas" to listOf(
            "площадь трапеции", "площадь ромба", "площадь параллелограмма", "площадь прямоугольника"
        ),
        "circle_disk_formulas" to listOf(
            "длина окружности", "площадь круга", "число пи", "длина дуги", "сектор"
        ),
        "stereometry_solids" to listOf(
            "стереометрия", "объем цилиндра", "объем конуса", "объем пирамиды", "объем шара", "площадь сферы"
        ),
        "trigonometry_circle_identities" to listOf(
            "тригонометрический круг", "основное тригонометрическое тождество", "синус", "косинус", "тангенс", "котангенс"
        ),
        "trigonometry_double_angle_sum" to listOf(
            "двойной угол", "синус двойного угла", "косинус двойного угла", "формулы сложения"
        ),
        "derivative_definition_rules" to listOf(
            "производная", "геометрический смысл производной", "правила дифференцирования", "касательная"
        ),
        "derivatives_table" to listOf(
            "таблица производных", "производная синуса", "производная косинуса", "производная корня"
        ),
        "integral_newton_leibniz" to listOf(
            "интеграл", "формула ньютона лейбница", "первообразная", "неопределенный интеграл", "определенный интеграл"
        ),
        "limits_lhopital" to listOf(
            "пределы", "правило лопиталя", "неопределенность 0 на 0", "замечательный предел"
        ),
        "combinatorics_permutations_combinations" to listOf(
            "комбинаторика", "факториал", "перестановки", "размещения", "сочетания с из n по k"
        ),
        "classical_probability_bernoulli" to listOf(
            "теория вероятностей", "классическая вероятность", "схема бернулли", "формула бернулли"
        ),
        "linear_algebra_matrices_determinant" to listOf(
            "матрицы", "детерминант", "определитель матрицы", "умножение матриц", "правило крамера"
        ),
        "vectors_dot_cross_product" to listOf(
            "векторы", "скалярное произведение", "длина вектора", "векторы перпендикулярны"
        )
    )

    fun normalizeText(text: String): String {
        return text
            .lowercase()
            .replace('ё', 'е')
            .replace(Regex("[.,/#!$%^&*;:{}=\\-_`~()?\"'«»()+\\[\\]]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    /**
     * Scored search over verified entries with keywords, intent synonyms and token overlap.
     */
    fun searchEntries(query: String, entries: List<KnowledgeEntity>): List<EntryMatch> {
        val normQuery = normalizeText(query)
        if (normQuery.isBlank()) return emptyList()

        val queryTokens = normQuery.split(" ").filter { it.length > 2 }
        val results = mutableListOf<EntryMatch>()

        for (entry in entries) {
            var score = 0
            var matchType = "fuzzy"

            val normTitle = normalizeText(entry.canonicalTitle)
            val normDef = normalizeText(entry.definition)
            val normExpl = normalizeText(entry.simpleExplanation)

            // Parse keywords
            val keywordsList = try {
                val arr = JSONArray(entry.keywordsJson)
                (0 until arr.length()).map { arr.getString(it) }
            } catch (e: Exception) {
                emptyList()
            }

            // 1. Direct match in keywords
            for (kw in keywordsList) {
                val normKw = normalizeText(kw)
                if (normQuery == normKw || normQuery.contains(normKw)) {
                    score += 100
                    matchType = "exact_keyword"
                    break
                }
                if (normKw.contains(normQuery)) {
                    score += 80
                    matchType = "exact_keyword"
                }
            }

            // 2. Synonyms mapping check
            val synonyms = INTENT_SYNONYMS[entry.id] ?: emptyList()
            for (syn in synonyms) {
                val normSyn = normalizeText(syn)
                if (normQuery == normSyn || normQuery.contains(normSyn)) {
                    score += 90
                    if (matchType != "exact_keyword") matchType = "synonym"
                    break
                }
                if (normSyn.contains(normQuery)) {
                    score += 70
                    if (matchType != "exact_keyword") matchType = "synonym"
                }
            }

            // 3. Token-level overlap
            for (token in queryTokens) {
                if (normTitle.contains(token)) {
                    score += 35
                }
                for (kw in keywordsList) {
                    if (normalizeText(kw).contains(token)) {
                        score += 25
                    }
                }
                if (normDef.contains(token)) {
                    score += 15
                }
                if (normExpl.contains(token)) {
                    score += 10
                }
            }

            // 4. Do not confuse check
            if (!entry.doNotConfuseTerm.isNullOrBlank()) {
                val confTerm = normalizeText(entry.doNotConfuseTerm)
                if (queryTokens.any { confTerm.contains(it) }) {
                    score += 20
                }
            }

            if (score > 15) {
                results.add(EntryMatch(entry, score, matchType))
            }
        }

        return results.sortedByDescending { it.score }
    }

    /**
     * Search textbook chunks by token frequency & title relevance
     */
    fun searchChunks(query: String, chunks: List<KnowledgeChunkEntity>): List<ChunkMatch> {
        val normQuery = normalizeText(query)
        if (normQuery.isBlank()) return emptyList()

        val queryTokens = normQuery.split(" ").filter { it.length > 2 }
        if (queryTokens.isEmpty()) return emptyList()

        val results = mutableListOf<ChunkMatch>()

        for (chunk in chunks) {
            var score = 0
            val normTitle = normalizeText(chunk.title)
            val normText = normalizeText(chunk.text)

            // Direct full phrase in text
            if (normText.contains(normQuery)) {
                score += 50
            }

            for (token in queryTokens) {
                if (normTitle.contains(token)) {
                    score += 30
                }
                if (normText.contains(token)) {
                    score += 10
                }
            }

            if (score >= 20) {
                results.add(ChunkMatch(chunk, score))
            }
        }

        return results.sortedByDescending { it.score }
    }

    /**
     * Hierarchical search:
     * 1. Entries search
     * 2. If empty -> Chunks search
     * 3. If empty -> NotFound
     */
    fun findBestMatch(
        query: String,
        entries: List<KnowledgeEntity>,
        chunks: List<KnowledgeChunkEntity>
    ): KnowledgeSearchResult {
        val entryMatches = searchEntries(query, entries)
        if (entryMatches.isNotEmpty() && entryMatches.first().score >= 30) {
            return KnowledgeSearchResult.EntryFound(entryMatches.first().entry, entryMatches.first().score)
        }

        val chunkMatches = searchChunks(query, chunks)
        if (chunkMatches.isNotEmpty() && chunkMatches.first().score >= 20) {
            return KnowledgeSearchResult.ChunkFound(chunkMatches.first().chunk, chunkMatches.first().score)
        }

        // Check if entries had a weaker match
        if (entryMatches.isNotEmpty()) {
            return KnowledgeSearchResult.EntryFound(entryMatches.first().entry, entryMatches.first().score)
        }

        return KnowledgeSearchResult.NotFound
    }
}
