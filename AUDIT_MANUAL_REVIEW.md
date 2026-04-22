# POIs pendientes de revisión manual

Generado automáticamente tras el audit. **26 POIs** requieren verificación con Google Maps antes de aplicar correcciones.

## Instrucciones

1. Para cada fila, abrir el link de Google Maps
2. Confirmar que el resultado corresponde al **nombre buscado** (no el `osmName`, que puede ser un false positive)
3. Click derecho sobre el pin correcto en Google Maps → copiar las coordenadas que aparecen al tope del menú
4. Reemplazar en la columna *Coord correcta*
5. Cuando estén completas, un segundo script puede leer este MD y aplicar las correcciones al dataset

> **Nota sobre status `not_found`**: los POIs con ese status no tuvieron match en OSM (no existe esa entidad en OpenStreetMap con un nombre razonablemente parecido). Se buscan completamente a mano en Google Maps. No hay `Match OSM` que comparar.

---

## Clínicas y hospitales (6)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| Clínica Alemana | wrong | Clínica Estética San Pascual (1535m) | `-33.4012, -70.5874` | _-33.39296205406836, -70.57273638758173_ | [buscar](https://www.google.com/maps/search/Cl%C3%ADnica%20Alemana%20Santiago%20Chile) |
| Clínica Las Condes | wrong | Clínica Orema (2265m) | `-33.4088, -70.5717` | _-33.38520843770616, -70.53152428836158_ | [buscar](https://www.google.com/maps/search/Cl%C3%ADnica%20Las%20Condes%20Santiago%20Chile) |
| Clínica UC Christus | wrong | Clínica Central (1014m) | `-33.4418, -70.6535` | _-33.442305223461155, -70.6405187579885_ | [buscar](https://www.google.com/maps/search/Cl%C3%ADnica%20UC%20Christus%20Santiago%20Chile) |
| Clínica Meds | wrong | Clínica Estética San Pascual (2125m) | `-33.3986, -70.5673` | _-33.355680382308755, -70.53515459715035_ | [buscar](https://www.google.com/maps/search/Cl%C3%ADnica%20Meds%20Santiago%20Chile) |
| Hospital Clínico U. Chile | not_found | — | `-33.4207, -70.6526` | _-33.42019415169235, -70.65479753260358_ | [buscar](https://www.google.com/maps/search/Hospital%20Cl%C3%ADnico%20U.%20Chile%20Santiago%20Chile) |
| Hospital Sótero del Río | not_found | — | `-33.5248, -70.5848` | _-33.57705595114272, -70.58120557186426_ | [buscar](https://www.google.com/maps/search/Hospital%20S%C3%B3tero%20del%20R%C3%ADo%20Santiago%20Chile) |

## Colegios (5)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| Colegio Verbo Divino | wrong | Colegio Dalcahue (1336m) | `-33.3965, -70.5590` | _-33.420235845177196, -70.58690137954444_ | [buscar](https://www.google.com/maps/search/Colegio%20Verbo%20Divino%20Santiago%20Chile) |
| Colegio Cumbres | wrong | Colegio San Miguel Arcángel (1463m) | `-33.3782, -70.5430` | _-33.39438830886777, -70.50471501534462_ | [buscar](https://www.google.com/maps/search/Colegio%20Cumbres%20Santiago%20Chile) |
| The Newland School | wrong | The Grange School (2233m) | `-33.4185, -70.5775` | _-33.36000934137578, -70.53286234490828_ | [buscar](https://www.google.com/maps/search/The%20Newland%20School%20Santiago%20Chile) |
| The Grange School | not_found | — | `-33.5102, -70.5440` | _-33.437273888825565, -70.5679208981276_ | [buscar](https://www.google.com/maps/search/The%20Grange%20School%20Santiago%20Chile) |
| Saint George's College | not_found | — | `-33.3792, -70.5180` | _-33.38413074797298, -70.60008998650848_ | [buscar](https://www.google.com/maps/search/Saint%20George's%20College%20Santiago%20Chile) |

## Institutos profesionales (3)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| DuocUC San Carlos Apoquindo | wrong | INACAP Apoquindo (1211m) | `-33.4051, -70.5395` | _-33.40015115386455, -70.50584197672316_ | [buscar](https://www.google.com/maps/search/DuocUC%20San%20Carlos%20Apoquindo%20Santiago%20Chile) |
| INACAP Providencia | wrong | Instituto Chileno Británico de Cultura SeDe Providencia (810m) | `-33.4240, -70.6100` | NO ENCONTRADO | [buscar](https://www.google.com/maps/search/INACAP%20Providencia%20Santiago%20Chile) |
| INACAP Maipú | needs_review | AIEP SeDe Maipu (229m) | `-33.5095, -70.7555` | _-33.480326012284095, -70.7557782195706_ | [buscar](https://www.google.com/maps/search/INACAP%20Maip%C3%BA%20Santiago%20Chile) |

## Centros comerciales (2)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| Mall Florida Center | wrong | Cenco Florida (2052m) | `-33.5250, -70.5935` | _-33.51061675343976, -70.60722724479993_ | [buscar](https://www.google.com/maps/search/Mall%20Florida%20Center%20Santiago%20Chile) |
| Mall Plaza Oeste | not_found | — | `-33.5190, -70.7305` | _-33.51728751153557, -70.71755650159322_ | [buscar](https://www.google.com/maps/search/Mall%20Plaza%20Oeste%20Santiago%20Chile) |

## Zonas de negocios (1)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| Centro Financiero Santiago | wrong | Centro Histórico (334m) | `-33.4400, -70.6530` | _-33.44074663438647, -70.65078508971384_ | [buscar](https://www.google.com/maps/search/Centro%20Financiero%20Santiago%20Santiago%20Chile) |

## Parques (4)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| Parque Balmaceda | wrong | Parque Canino (1944m) | `-33.4335, -70.6255` | _-33.43487328339283, -70.62951706228455_ | [buscar](https://www.google.com/maps/search/Parque%20Balmaceda%20Santiago%20Chile) |
| Parque de la Familia | wrong | Parque Canino Montegrande (1569m) | `-33.4058, -70.5640` | _-33.426055231389526, -70.67709970978532_ | [buscar](https://www.google.com/maps/search/Parque%20de%20la%20Familia%20Santiago%20Chile) |
| Parque Padre Hurtado | wrong | Parque Arboretum (2859m) | `-33.4690, -70.5505` | _-33.43157667190622, -70.54572144531774_ | [buscar](https://www.google.com/maps/search/Parque%20Padre%20Hurtado%20Santiago%20Chile) |
| Parque Brasil | wrong | Parque O'Higgins (3195m) | `-33.4365, -70.6515` | _-33.519060496383126, -70.61145027393847_ | [buscar](https://www.google.com/maps/search/Parque%20Brasil%20Santiago%20Chile) |

## Universidades (3)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| UDP Facultad Economía | wrong | Facultad Medicina UDP (2414m) | `-33.4408, -70.6376` | _-33.39381892430754, -70.61300327301696_ | [buscar](https://www.google.com/maps/search/UDP%20Facultad%20Econom%C3%ADa%20Santiago%20Chile) |
| UDP Facultad Comunicaciones | not_found | — | `-33.4475, -70.6295` | _-33.45036552336299, -70.66189492394017_ | [buscar](https://www.google.com/maps/search/UDP%20Facultad%20Comunicaciones%20Santiago%20Chile) |
| UDD Las Condes | not_found | — | `-33.4068, -70.5575` | _-33.391813447247166, -70.50115380793218_ | [buscar](https://www.google.com/maps/search/UDD%20Las%20Condes%20Santiago%20Chile) |

## Estaciones de tren (2)

| Nombre buscado | Status | Match OSM (puede ser FP) | Coord actual | Coord correcta | Link GMaps |
|---|---|---|---|---|---|
| Estación Maestranza EFE | not_found | — | `-33.5385, -70.7080` | _-33.60634692401718, -70.69700519080732_ | [buscar](https://www.google.com/maps/search/Estaci%C3%B3n%20Maestranza%20EFE%20Santiago%20Chile) |
| Estación Nos EFE | not_found | — | `-33.5985, -70.7110` | _-33.63282429930699, -70.70507412616863_ | [buscar](https://www.google.com/maps/search/Estaci%C3%B3n%20Nos%20EFE%20Santiago%20Chile) |

---

## Después de completar la tabla

Guardar este archivo con las coordenadas llenadas y avisar a Claude con el prompt de “aplicar correcciones manuales” — un script leerá la columna *Coord correcta* y actualizará `src/lib/data/attractors.ts`.
