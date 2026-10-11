-- Seed data for CUT&CO, a fictional barbershop. Everything here is invented:
-- the address does not exist, the phone number is from the range Ofcom reserves
-- for drama, and the email domain is reserved for examples.
--
-- Safe to run again: existing rows are left alone.

insert into public.shop_settings (name, address_line1, city, postcode, phone, email)
values ('CUT&CO', '27 Calvert Yard', 'London', 'E2 7JQ', '+44 20 7946 0127', 'hello@cutco.example')
on conflict (id) do nothing;

insert into public.services
  (slug, name_en, name_ru, description_en, description_ru, price_cents, duration_minutes, sort_order)
values
  ('haircut', 'Haircut', 'Стрижка',
   'Consultation, scissor or clipper cut, wash and finish.',
   'Консультация, стрижка ножницами или машинкой, мытьё и укладка.',
   4500, 45, 10),
  ('skin-fade', 'Skin Fade', 'Фейд под ноль',
   'A tight fade taken down to the skin, blended by hand.',
   'Плотный переход до кожи, выведенный вручную.',
   5000, 50, 20),
  ('haircut-and-beard', 'Haircut & Beard', 'Стрижка и борода',
   'A full cut and a shaped beard in one sitting.',
   'Стрижка и оформление бороды за один визит.',
   6800, 65, 30),
  ('beard-trim', 'Beard Trim', 'Оформление бороды',
   'Shape, line and length, finished with oil.',
   'Форма, контур и длина, в завершение — масло.',
   2800, 25, 40),
  ('hot-towel-shave', 'Hot Towel Shave', 'Бритьё с горячим полотенцем',
   'A straight-razor shave with hot towels and a cold finish.',
   'Бритьё опасной бритвой с горячими полотенцами и холодным компрессом.',
   4800, 40, 50),
  ('buzz-cut', 'Buzz Cut', 'Стрижка под машинку',
   'One length all over, edges squared off.',
   'Одна длина по всей голове, чёткая окантовка.',
   3000, 25, 60),
  ('kids-cut', 'Kids'' Cut', 'Детская стрижка',
   'For under-twelves. Patience included.',
   'Для детей до двенадцати лет. Терпение входит в стоимость.',
   3200, 30, 70),
  ('grey-blending', 'Grey Blending', 'Камуфляж седины',
   'A soft colour pass that tones grey down without hiding it.',
   'Мягкое тонирование, которое приглушает седину, не скрывая её полностью.',
   4000, 35, 80)
on conflict (slug) do nothing;

insert into public.barbers (slug, name, title_en, title_ru, bio_en, bio_ru, sort_order)
values
  ('marcus-hale', 'Marcus Hale', 'Head Barber', 'Главный барбер',
   'Fifteen years behind the chair. Marcus cuts classic shapes and keeps the razor work for himself.',
   'Пятнадцать лет за креслом. Маркус делает классические формы, а работу с бритвой оставляет себе.',
   10),
  ('daniyar-akhmetov', 'Daniyar Akhmetov', 'Senior Barber', 'Старший барбер',
   'Fades are his subject. Daniyar works slowly at the temples and it shows.',
   'Его тема — фейды. Данияр не торопится на висках, и это заметно.',
   20),
  ('theo-okafor', 'Theo Okafor', 'Barber', 'Барбер',
   'Texture, curls and longer cuts. Theo is the one to ask about growing it out.',
   'Текстура, кудри и удлинённые стрижки. К Тео идут, когда хотят отрастить.',
   30),
  ('leon-fischer', 'Leon Fischer', 'Barber', 'Барбер',
   'Beards and colour. Leon handles grey blending and anything with a sharp line.',
   'Бороды и цвет. Леон делает камуфляж седины и всё, где нужен чёткий контур.',
   40)
on conflict (slug) do nothing;

-- Who does what. Nobody does everything, so "Any available" has real work to do.
insert into public.barber_services (barber_id, service_id)
select b.id, s.id
from (values
  ('marcus-hale', 'haircut'), ('marcus-hale', 'haircut-and-beard'), ('marcus-hale', 'beard-trim'),
  ('marcus-hale', 'hot-towel-shave'), ('marcus-hale', 'buzz-cut'),
  ('daniyar-akhmetov', 'haircut'), ('daniyar-akhmetov', 'skin-fade'), ('daniyar-akhmetov', 'buzz-cut'),
  ('daniyar-akhmetov', 'kids-cut'), ('daniyar-akhmetov', 'beard-trim'),
  ('theo-okafor', 'haircut'), ('theo-okafor', 'skin-fade'), ('theo-okafor', 'kids-cut'),
  ('theo-okafor', 'buzz-cut'),
  ('leon-fischer', 'haircut'), ('leon-fischer', 'haircut-and-beard'), ('leon-fischer', 'beard-trim'),
  ('leon-fischer', 'hot-towel-shave'), ('leon-fischer', 'grey-blending')
) as pair (barber_slug, service_slug)
join public.barbers b on b.slug = pair.barber_slug
join public.services s on s.slug = pair.service_slug
on conflict do nothing;

-- Weekly hours in London time. The shop is closed on Mondays; each barber has
-- a second day off and a lunch gap.
insert into public.working_hours (barber_id, weekday, start_time, end_time)
select b.id, hours.weekday, hours.start_time::time, hours.end_time::time
from (values
  -- Marcus: Tuesday to Saturday.
  ('marcus-hale', 2, '10:00', '14:00'), ('marcus-hale', 2, '15:00', '19:00'),
  ('marcus-hale', 3, '10:00', '14:00'), ('marcus-hale', 3, '15:00', '19:00'),
  ('marcus-hale', 4, '10:00', '14:00'), ('marcus-hale', 4, '15:00', '19:00'),
  ('marcus-hale', 5, '10:00', '14:00'), ('marcus-hale', 5, '15:00', '20:00'),
  ('marcus-hale', 6, '09:00', '13:00'), ('marcus-hale', 6, '14:00', '18:00'),
  -- Daniyar: Wednesday to Sunday.
  ('daniyar-akhmetov', 3, '11:00', '15:00'), ('daniyar-akhmetov', 3, '16:00', '20:00'),
  ('daniyar-akhmetov', 4, '11:00', '15:00'), ('daniyar-akhmetov', 4, '16:00', '20:00'),
  ('daniyar-akhmetov', 5, '11:00', '15:00'), ('daniyar-akhmetov', 5, '16:00', '20:00'),
  ('daniyar-akhmetov', 6, '09:00', '13:00'), ('daniyar-akhmetov', 6, '14:00', '18:00'),
  ('daniyar-akhmetov', 7, '11:00', '17:00'),
  -- Theo: Tuesday to Friday, and Sunday.
  ('theo-okafor', 2, '10:00', '13:30'), ('theo-okafor', 2, '14:30', '19:00'),
  ('theo-okafor', 3, '10:00', '13:30'), ('theo-okafor', 3, '14:30', '19:00'),
  ('theo-okafor', 4, '10:00', '13:30'), ('theo-okafor', 4, '14:30', '19:00'),
  ('theo-okafor', 5, '10:00', '13:30'), ('theo-okafor', 5, '14:30', '20:00'),
  ('theo-okafor', 7, '11:00', '17:00'),
  -- Leon: Tuesday, and Thursday to Saturday.
  ('leon-fischer', 2, '10:00', '14:00'), ('leon-fischer', 2, '15:00', '19:00'),
  ('leon-fischer', 4, '12:00', '16:00'), ('leon-fischer', 4, '17:00', '20:00'),
  ('leon-fischer', 5, '10:00', '14:00'), ('leon-fischer', 5, '15:00', '20:00'),
  ('leon-fischer', 6, '09:00', '13:00'), ('leon-fischer', 6, '14:00', '18:00')
) as hours (barber_slug, weekday, start_time, end_time)
join public.barbers b on b.slug = hours.barber_slug
on conflict do nothing;
