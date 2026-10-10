# CUT&CO — фотографии для сайта

Список снимков, которые нужно сгенерировать (в ChatGPT, как для NOVA), и готовые
промпты. Всего 16 файлов.

## Как сдавать

1. Сохраняйте файлы как `01.png` … `16.png` — номер из таблицы ниже.
2. Складывайте в `E:\Projects\portfolio\barbershop-images-inbox\` (папка вне git).
3. Из `barbershop-demo/` запустите `npm run images -- ../barbershop-images-inbox`.
   Скрипт приведёт снимки к единой цветокоррекции и положит их в `public/images`.
   Можно сдавать частями: недостающие номера скрипт пропустит.

## Общий стиль — вставлять в начало каждого промпта

Все снимки должны выглядеть как одна съёмка в одном помещении. Этот абзац задаёт
помещение и манеру; добавляйте его перед описанием конкретного кадра.

```
Documentary photograph, shot on 35mm film, natural grain, shallow depth of field.
A small independent barbershop in East London: matte black walls, polished concrete
floor, two vintage barber chairs in oxblood leather with chrome bases, a long
walnut counter, brass wall lamps, large mirrors with thin black frames, warm
tungsten light against deep shadows. Muted colour, high contrast, no neon.
No text, no logos, no signage, no watermarks, no brand names anywhere in the frame.
Realistic skin and hands, realistic tools. Not a 3D render, not an illustration.
```

## Барберы

Четыре постоянных персонажа. Опишите внешность одинаково в каждом кадре, где
человек появляется, чтобы он оставался узнаваемым.

- **Marcus Hale** — white British man in his mid-forties, short grey-flecked dark
  hair, trimmed salt-and-pepper beard, black work apron over a dark shirt, tattooed forearms.
- **Daniyar Akhmetov** — Kazakh man in his early thirties, black hair with a sharp
  low fade, clean-shaven, black t-shirt, slim build.
- **Theo Okafor** — Black British man in his late twenties, short twists on top
  with a taper, short beard, charcoal overshirt.
- **Leon Fischer** — German man in his mid-thirties, sandy-blond slicked-back hair,
  full well-shaped beard, rolled-sleeve grey shirt, black apron.

## Кадры

| № | Куда | Формат | Промпт (после общего стиля) |
|---|---|---|---|
| 01 | Главная, большой кадр (десктоп) | горизонтальный 3:2 | `Wide interior view of the empty shop in the early evening, both chairs facing the mirrors, lamps on, the street visible as a dark blur through the window. Generous dark empty space in the upper left third of the frame.` |
| 02 | Главная, большой кадр (телефон) | вертикальный 4:5 | `Vertical view of one oxblood barber chair from a three-quarter angle, mirror and brass lamp behind it, the upper third of the frame dark and empty.` |
| 03 | Портрет Marcus Hale | вертикальный 4:5 | `Portrait of Marcus Hale standing beside his chair, arms crossed, looking at the camera, calm and direct, lit from the side.` |
| 04 | Портрет Daniyar Akhmetov | вертикальный 4:5 | `Portrait of Daniyar Akhmetov leaning on the walnut counter, clippers in one hand, looking at the camera with a slight smile, lit from the side.` |
| 05 | Портрет Theo Okafor | вертикальный 4:5 | `Portrait of Theo Okafor sitting on the arm of a barber chair, relaxed, looking at the camera, lit from the side.` |
| 06 | Портрет Leon Fischer | вертикальный 4:5 | `Portrait of Leon Fischer standing in front of a mirror, a straight razor folded in his hand, looking at the camera, serious, lit from the side.` |
| 07 | Галерея: фейд | вертикальный 4:5 | `Close view from behind of a client's head with a precise skin fade, Daniyar Akhmetov's hands finishing the neckline with a trimmer.` |
| 08 | Галерея: борода | горизонтальный 3:2 | `Close-up of Leon Fischer shaping a client's beard with scissors and a comb, the client's eyes closed.` |
| 09 | Галерея: бритьё | горизонтальный 3:2 | `Marcus Hale holding a steaming white towel over a reclined client's face, a straight razor and shaving brush on the counter in the foreground.` |
| 10 | Галерея: инструменты | горизонтальный 3:2 | `Still life on the walnut counter: clippers, scissors, a comb, a straight razor and a brush laid out in a row on a black towel, seen from above at an angle.` |
| 11 | Галерея: кресло | вертикальный 4:5 | `Detail of an oxblood leather barber chair: the headrest, worn leather and chrome, a brass lamp out of focus behind.` |
| 12 | Галерея: витрина | горизонтальный 3:2 | `The shopfront from across a wet London street at dusk: black painted frontage, large window glowing warm, a barber and a client visible inside as silhouettes. No lettering on the shopfront.` |
| 13 | Галерея: мойка | горизонтальный 3:2 | `Theo Okafor washing a client's hair at a black ceramic basin, water and foam, seen from the side.` |
| 14 | Галерея: результат | вертикальный 4:5 | `A client in his thirties looking at his finished haircut in the mirror, seen over his shoulder, Marcus Hale holding a hand mirror behind him.` |
| 15 | О нас: команда | горизонтальный 3:2 | `All four barbers together in the shop after closing — Marcus Hale, Daniyar Akhmetov, Theo Okafor and Leon Fischer — two seated in the chairs, two standing, talking and laughing, not looking at the camera.` |
| 16 | Услуги: деталь | горизонтальный 3:2 | `Extreme close-up of clippers cutting a clean line at a client's temple, fine hair in the air, very shallow focus.` |

## На что смотреть

- Нигде нет надписей и логотипов: вывеска CUT&CO на фото не нужна.
- Руки и инструменты выглядят правдоподобно.
- Стены чёрные, кресла бордовые — во всех кадрах.
- Портреты сняты на одном уровне и с одним светом: на странице они стоят в ряд.
- В кадрах 01 и 02 сверху остаётся тёмное пустое место: туда ложится заголовок.
