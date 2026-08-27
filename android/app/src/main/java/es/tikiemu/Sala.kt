package es.tikiemu

/**
 * Estado de la sala: slots, tokens y reglas de reparto.
 *
 * Traducción de `server-node/rooms.js`. Se escribió allí sin saber nada de
 * WebSockets ni de HTTP precisamente para que este paso fuera mecánico: si
 * cambian las reglas, cambian en los dos sitios y deben seguir coincidiendo.
 */
class Sala(val total: Int = SLOTS) {

    companion object {
        /**
         * Puestos de la sala. Dos, porque es el techo de la emulación en
         * navegador (docs/paso-0-jugadores.md). El protocolo admite hasta 4.
         */
        const val SLOTS = 2

        /** Cuánto se reserva un slot tras caerse su mando, en milisegundos. */
        const val RESERVA_MS = 30_000L
    }

    data class Ocupante(val token: String, var conectado: Boolean, var desdeQue: Long?)

    data class EstadoSlot(val n: Int, val taken: Boolean, val conectado: Boolean)

    private val ocupacion = mutableMapOf<Int, Ocupante>()
    private val tokens = mutableMapOf<String, Int>()
    private var siguienteToken = 1

    /** Token opaco, sin pretensiones criptográficas. */
    @Synchronized
    fun crearToken(): String {
        val n = siguienteToken++
        val azar = (Math.random() * 0xffffff).toInt()
        return "${n.toString(36)}-${azar.toString(36)}"
    }

    /** Estado de los slots tal como viaja en el protocolo (§6.1). */
    @Synchronized
    fun listaSlots(): List<EstadoSlot> = (1..total).map { n ->
        val info = ocupacion[n]
        EstadoSlot(n = n, taken = info != null, conectado = info?.conectado ?: false)
    }

    sealed class Resultado {
        data class Ok(val slot: Int) : Resultado()
        data class Error(val code: String) : Resultado()
    }

    @Synchronized
    fun reclamar(slot: Int, token: String): Resultado {
        if (slot < 1 || slot > total) return Resultado.Error("SLOT_TAKEN")

        // Un slot ocupado solo se cede a su propio dueño (reconexión).
        val actual = ocupacion[slot]
        if (actual != null && actual.token != token) return Resultado.Error("SLOT_TAKEN")

        // Si este token ya tenía otro slot, lo suelta antes de coger el nuevo.
        val anterior = tokens[token]
        if (anterior != null && anterior != slot) ocupacion.remove(anterior)

        ocupacion[slot] = Ocupante(token, conectado = true, desdeQue = null)
        tokens[token] = slot
        return Resultado.Ok(slot)
    }

    @Synchronized
    fun slotDe(token: String?): Int? = token?.let { tokens[it] }

    /** Libera el slot de un token por voluntad propia. */
    @Synchronized
    fun soltar(token: String): Int? {
        val slot = tokens.remove(token) ?: return null
        ocupacion.remove(slot)
        return slot
    }

    /**
     * Libera un slot por decisión ajena: su token deja de valer, para que el
     * expulsado no lo recupere al reconectar (HU-10).
     */
    @Synchronized
    fun expulsar(slot: Int): Int? {
        val info = ocupacion.remove(slot) ?: return null
        tokens.remove(info.token)
        return slot
    }

    /**
     * Marca un mando como caído sin liberar su slot: se reserva por si vuelve
     * tras un bloqueo de pantalla (HU-09).
     */
    @Synchronized
    fun desconectar(token: String): Int? {
        val slot = tokens[token] ?: return null
        ocupacion[slot]?.apply {
            conectado = false
            desdeQue = System.currentTimeMillis()
        }
        return slot
    }

    /** Libera los slots cuya reserva ha vencido. */
    @Synchronized
    fun limpiarCaducados(ahora: Long = System.currentTimeMillis()): List<Int> {
        val liberados = mutableListOf<Int>()
        val it = ocupacion.entries.iterator()
        while (it.hasNext()) {
            val (slot, info) = it.next()
            val desde = info.desdeQue
            if (!info.conectado && desde != null && ahora - desde > RESERVA_MS) {
                it.remove()
                tokens.remove(info.token)
                liberados.add(slot)
            }
        }
        return liberados
    }

    @Synchronized
    fun llena(): Boolean = ocupacion.size >= total
}
