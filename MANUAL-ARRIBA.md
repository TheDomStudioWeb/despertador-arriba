# Arriba — Manual interno

**Arriba** es un despertador con misiones para Android, hecho por The DOM Studio Web. Funciona como Alarmy pero gratis y sin publicidad: la alarma **no se apaga con un botón**. Para apagarla hay que cumplir una misión que obliga a levantarse de la cama. La misión cambia al azar cada día.

- Plataforma: Android 8 o más nuevo (APK). La versión para iPhone queda para más adelante.
- Repositorio: `TheDomStudioWeb/despertador-arriba`. Cada cambio en `main` compila el APK solo y lo publica en **Releases** como `Arriba.apk`.
- Funciona sin internet. Los datos quedan solo en el teléfono.

---

## 1. Instalar y dejarla lista

1. Desde el teléfono, entrá a la página de **Releases** del repositorio y descargá `Arriba.apk`.
2. Abrilo y aceptá "instalar apps de origen desconocido" si el teléfono lo pide.
3. Abrí Arriba. Si arriba aparece el cartel rojo **"Faltan permisos"**, tocá **Revisar**. Después tocá **Activar** en cada permiso hasta que todos tengan el tilde verde.

| Permiso | Para qué sirve |
|---|---|
| Notificaciones | Mostrar la alarma |
| Pantalla completa | Que la misión aparezca aunque el teléfono esté bloqueado |
| Mostrar sobre otras apps | Que la alarma vuelva sola si la persona se va a otra app |
| Alarmas exactas | Que suene justo a la hora |
| Sin ahorro de batería | Que el teléfono no cierre la app de noche |
| Cámara | Misiones de foto, color y código |
| Actividad física | Contar pasos con el sensor del teléfono |

Las actualizaciones se instalan encima de la anterior y no se pierden las alarmas.

---

## 2. Crear una alarma

En la pestaña **Alarmas** hay que tocar el botón dorado **+**.

- **Hora:** con las flechas ▲▼ (si se mantienen apretadas, avanzan rápido) o tocando el número.
- **Días:** se tocan los días uno por uno, o se usan los atajos "Todos los días", "Lunes a viernes" o "Una sola vez". Una alarma de una sola vez se apaga sola después de sonar.
- **Nombre:** es opcional (por ejemplo, "Colegio").
- **Misiones posibles:** son las misiones entre las que se sortea cada mañana. Cuantas más se marquen, más variado es el sorteo.
- **Misiones para apagarla:** 1, 2 o 3 misiones seguidas.
- **Dificultad:** Fácil, Normal o Difícil. Cambia cuántos pasos, sacudidas o cuentas se piden.
- **Posponer:** Nunca, 1, 2 o 3 veces, de 3, 5 o 10 minutos. Posponer no apaga la alarma: cuando vuelve a sonar, la misión sigue pendiente.
- **Sonido:** Clásico, Digital, Sirena, Campanas o el tono de alarma del teléfono. Al tocar uno se escucha de muestra. La vibración también se puede activar o desactivar.
- **Probar alarma:** la guarda y la hace sonar en 10 segundos. Sirve para probar con el teléfono bloqueado.

El interruptor de cada tarjeta prende o apaga la alarma sin borrarla. Arriba de todo se ve cuánto falta para la próxima.

---

## 3. Las 10 misiones

| Misión | Qué hay que hacer | Cómo lo comprueba |
|---|---|---|
| **Foto de un objeto** | Ir hasta un objeto registrado (por ejemplo, la pileta del baño) y sacarle una foto | Compara la foto con la de referencia: colores, forma y lo que reconoce la inteligencia artificial del teléfono |
| **Escanear un código** | Escanear el código de barras o QR registrado (por ejemplo, el de la pasta dental) | Lee el código y tiene que ser exactamente ese |
| **Cazá un color** | Sacarle una foto a algo del color que toque (rojo, azul, verde, amarillo, naranja, violeta) | El color tiene que llenar buena parte del marco. No repite el color del día anterior |
| **Caminá** | Dar entre 20 y 80 pasos según la dificultad | Usa el sensor de pasos. Sacudir el teléfono no cuenta |
| **Sentadillas** | Hacer entre 8 y 23 sentadillas con el teléfono contra el pecho | Detecta el movimiento de bajar y subir. Es aproximado |
| **Sacudí el teléfono** | Hacer entre 30 y 90 sacudidas fuertes | Solo cuentan los movimientos bruscos |
| **Prendé la luz** | Prender la luz o abrir la cortina | Usa el sensor de luz: tiene que haber luz real durante 4 segundos |
| **Cuentas** | Resolver de 3 a 5 cuentas | Si una sale mal, aparece otra |
| **Memoria** | Repetir una secuencia de luces que va creciendo hasta 4, 6 u 8 | Si hay un error, vuelve a empezar |
| **Escribí la frase** | Copiar una frase (no se puede pegar) | No importan las mayúsculas ni los acentos |

Las misiones de **foto** y **código** aparecen como "Falta registrar" hasta que se registra algo en la pestaña **Objetos**. La de **luz** no aparece si el teléfono no tiene sensor de luz.

En **Difícil**, las misiones de foto, código y color piden 2 cosas distintas (si hay 2 registradas).

---

## 4. Registrar objetos y códigos (pestaña Objetos)

Conviene registrar cosas **lejos de la cama**: la pileta del baño, la heladera, la cafetera, la pasta dental.

- **Registrar objeto:** primero hay que escribir qué es y sacarle una foto. Se pueden sumar hasta 3 ángulos para que lo reconozca mejor. Con **Probar** se saca otra foto y se ve el porcentaje de parecido. Al final se toca **Guardar**.
- **Registrar código:** hay que apuntar a un código de barras o QR. Cuando lo lee, se escribe dónde está y se toca **Guardar**.
- El botón ▶ de un objeto sirve para practicar la misión de foto con ese objeto. Para borrar, se toca el tacho dos veces.

**Exigencia de las fotos** (en Ajustes): con **Fácil** acepta fotos menos parecidas y con **Estricta** pide que sean casi iguales. Si rechaza el objeto correcto, conviene bajarla. Si se la engaña muy fácil, conviene subirla.

---

## 5. Cuando suena la alarma

1. La pantalla se prende sola, aunque el teléfono esté bloqueado, y muestra la hora y cuántas misiones tocan.
2. Se toca **Empezar misión**. Mientras se hace la misión, el volumen baja. Si se deja de hacer durante 25 segundos, vuelve a sonar a todo volumen.
3. Al cumplir todas aparece "¡Buen día!" y la alarma se apaga.

**Cosas que NO la apagan (anti-trampa):**
- El botón "atrás" no hace nada.
- Si se sale con el botón de inicio, la pantalla de la misión vuelve en unos segundos.
- Si se cierra la app desde "recientes", vuelve a sonar.
- Si se reinicia el teléfono, vuelve a sonar apenas prende.
- Si se baja el volumen, la app lo vuelve a poner al máximo.
- La notificación no tiene botón para apagar.

**Si una misión no se puede hacer** (por ejemplo, se rompió la cámara): a los 2 minutos aparece el botón **"No puedo hacer esta misión → cambiar por otra"**. Se puede usar hasta 2 veces y la cambia por una misión sin cámara. **Nunca apaga la alarma.**

Al terminar, el volumen de alarmas del teléfono vuelve a como estaba.

---

## 6. Otras pestañas

- **Misiones:** ahí se practica cualquier misión, eligiendo la dificultad, sin que suene nada.
- **Ajustes:** los permisos, la exigencia de las fotos, el historial de las últimas 10 alarmas (con el tilde de cumplida y cuántas veces se pospuso) y la firma de The DOM Studio Web.

---

## 7. Preguntas frecuentes

- **No sonó.** Revisá que todos los permisos de Ajustes estén en verde, sobre todo "Sin ahorro de batería". En Motorola y Samsung conviene además fijar la app en recientes.
- **Sonó pero no apareció la pantalla.** Falta el permiso "Pantalla completa" o "Mostrar sobre otras apps". Tocando la notificación también se abre.
- **No reconoce mi objeto.** Registralo con buena luz, sumá otro ángulo o bajá la exigencia a Fácil.
- **Las sentadillas no cuentan bien.** Tené el teléfono firme contra el pecho y bajá bien. Si igual falla, sacá esa misión de la alarma.
- **¿Y en iPhone?** Todavía no. Apple pide una Mac o una cuenta de desarrollador para instalar apps propias. Queda pendiente.

---

**Arriba** · Hecho por **The DOM Studio Web** — Estructura y potencia digital
thedomstudioweb.github.io · WhatsApp 261-3431216
