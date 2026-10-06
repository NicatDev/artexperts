from django.core.management.base import BaseCommand
from django.db import transaction
from users.models import User, ArtistProfile
from artworks.models import ArtworkCategory
from articles.models import ArticleCategory
from pages.models import HeroBanner, HeroBannerTranslation, AboutPageContent, AboutPageTranslation, SiteSettings


class Command(BaseCommand):
    help = "Seeds initial database records including Ilqar Mammadov founder profile, categories, and bilingual pages"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Starting initial data seed...")

        # 1. Superuser / Founder: Ilqar Mammadov
        founder, created = User.objects.get_or_create(
            email='admin@art.az',
            defaults={
                'is_staff': True,
                'is_superuser': True,
                'is_artist': True,
                'is_verified': True,
            }
        )
        if created:
            founder.set_password('admin12345')
            founder.save()
            self.stdout.write(self.style.SUCCESS("Created founder user: admin@art.az (password: admin12345)"))

        profile, _ = ArtistProfile.objects.get_or_create(
            user=founder,
            defaults={
                'full_name': 'İlqar Məmmədov',
                'username': 'ilqar-mammadov',
                'is_founder': True,
                'is_featured': True,
                'location': 'Bakı, Azərbaycan',
                'specialties': 'Klassik və Müasir Yağlı Boya, Kətan, Qrafika',
                'short_bio': 'Azərbaycan rəssamı, fəlsəfi və bədii vizual konsepsiyaların müəllifi.',
                'artist_statement': (
                    'Sənət insanın daxili aləminin və kainatın harmoniyasının vizual təcəssümüdür. '
                    'Bu platformanı təkcə öz arxivimi və əsərlərimi nümayiş etdirmək üçün deyil, '
                    'həm də sənət yoluna yenicə qədəm qoyan və peşəkar rəssamların özlərini dünyaya tanıtması, '
                    'əsərlərini, kitablarını və düşüncələrini bölüşməsi üçün dəstək məqsədilə yaratdım.'
                ),
                'website': 'https://ilqarmammadov.art',
            }
        )

        # 2. Artwork Categories
        art_categories = [
            ('yagli-boya', 'Yağlı Boya', 'Oil on Canvas', 'Масляная живопись'),
            ('qrafika', 'Qrafika və Rəsm', 'Graphics & Drawing', 'Графика и Рисунок'),
            ('akvarel', 'Akvarel', 'Watercolor', 'Акварель'),
            ('modern-art', 'Müasir Sənət', 'Contemporary Art', 'Современное искусство'),
        ]
        for slug, az, en, ru in art_categories:
            ArtworkCategory.objects.get_or_create(
                slug=slug,
                defaults={'name_az': az, 'name_en': en, 'name_ru': ru}
            )

        from books.models import BookCategory
        BookCategory.objects.get_or_create(
            slug='monoqrafiyalar',
            defaults={'name_az': 'Monoqrafiyalar', 'name_en': 'Monographs', 'name_ru': 'Монографии'},
        )

        # 3. Article Categories
        article_categories = [
            ('senet-nezeriyyesi', 'Sənət Nəzəriyyəsi', 'Art Theory', 'Теория искусства'),
            ('ressamliq-dersleri', 'Rəssamlıq Dərsləri', 'Painting Masterclasses', 'Уроки живописи'),
            ('sergi-tehlilleri', 'Sərgi və Rəylər', 'Exhibitions & Reviews', 'Выставки и обзоры'),
            ('senet-felsefesi', 'Sənət Fəlsəfəsi', 'Art Philosophy', 'Философия искусства'),
        ]
        for slug, az, en, ru in article_categories:
            ArticleCategory.objects.get_or_create(
                slug=slug,
                defaults={'name_az': az, 'name_en': en, 'name_ru': ru}
            )

        # 4. Hero Banner
        banner, _ = HeroBanner.objects.get_or_create(
            is_active=True,
            defaults={'cta_url': '/artworks'}
        )
        HeroBannerTranslation.objects.update_or_create(
            banner=banner,
            language='az',
            defaults={
                'title': 'Art Experts — Müasir və Klassik Təsviri Sənət Platforması',
                'subtitle': 'Milli və müasir rəssamlıq sənətinin rəqəmsal arxivi, müəllif kitabları və yaradıcılar üçün sənət məkanı.',
                'cta_text': 'Qalereyanı Kəşf Et'
            }
        )
        HeroBannerTranslation.objects.update_or_create(
            banner=banner,
            language='en',
            defaults={
                'title': 'Art Experts — Curated Fine Art Platform',
                'subtitle': 'The digital archive of fine arts, author monographs, and a curated haven for emerging & master artists.',
                'cta_text': 'Explore Gallery'
            }
        )
        HeroBannerTranslation.objects.update_or_create(
            banner=banner,
            language='ru',
            defaults={
                'title': 'Art Experts — Кураторская Арт-платформа',
                'subtitle': 'Цифровой архив изобразительного искусства, авторские книги и творческое пространство для художников.',
                'cta_text': 'Исследовать галерею'
            }
        )

        # 5. About Page Content
        about, _ = AboutPageContent.objects.get_or_create(is_active=True)

        AboutPageTranslation.objects.update_or_create(
            about_page=about,
            language='az',
            defaults={
                'biography_title': 'İlqar Məmmədov haqqında',
                'biography_text': (
                    'İlqar Məmmədov Azərbaycan Dövlət Pedaqoji Universitetinin təcrübəli və nüfuzlu müəllimlərindən biridir. '
                    'Onun uzun illər ərzində təsviri incəsənət sahəsində apardığı elmi-pedaqoji fəaliyyət, hazırladığı əsərlər '
                    'və tədris vəsaitləri tələbələrin peşəkar inkişafında mühüm əhəmiyyət daşıyır. Müəllifin kitabları gələcək '
                    'təsviri incəsənət müəllimlərinin nəzəri biliklərinin zənginləşməsinə, bədii dünyagörüşünün formalaşmasına '
                    'və yaradıcılıq bacarıqlarının inkişafına mühüm töhfə verir.'
                ),
                'founder_story_title': 'Yaradıcılıq və Təsisçi Hekayəsi',
                'founder_story_text': (
                    'Uzun illər boyu emalatxanasında sənətin ən incə məqamları üzərində çalışan İlqar Məmmədov, '
                    'təkcə öz əsərlərini deyil, həm də sənət haqqında topladığı fundamental bilikləri, monoqrafiyaları '
                    'və təcrübəni rəqəmsal dövrün tələblərinə uyğun bir məkanda birləşdirmək qərarına gəlmişdir.'
                ),
                'mission_title': 'Platformanın Missiyası',
                'mission_text': (
                    'Bu platforma saytın qurucusu İlqar Məmmədov tərəfindən sənət yolunda ilk addımlarını atan istedadlı gənclərə '
                    'və peşəkar rəssamlara dəstək məqsədilə təsis edilmişdir. Əsas məqsədimiz hər bir sənətkara öz portfelini, '
                    'əsərlərini, elmi və publisistik məqalələrini, eləcə də kitablarını dünya miqyasında nümayiş etdirmək üçün '
                    'peşəkar, kurasiya olunmuş rəqəmsal tribuna bəxş etməkdir.'
                ),
                'vision_title': 'Gələcəyə Baxışımız (Vizyon)',
                'vision_text': (
                    'Milli sənət irsimizi qoruyaraq, onu qlobal incəsənət ekosisteminə inteqrasiya edən, '
                    'müəllif hüquqlarına və rəqəmsal mülkiyyətə hörmətlə yanaşan, sənətlə kolleksiyaçını birləşdirən '
                    'beynəlxalq sənət ocağına çevrilmək.'
                )
            }
        )

        AboutPageTranslation.objects.update_or_create(
            about_page=about,
            language='en',
            defaults={
                'biography_title': 'About Ilqar Mammadov',
                'biography_text': (
                    'Ilqar Mammadov is a distinguished Azerbaijani artist blending deep classical traditions '
                    'with modern philosophical aesthetics. His canvases reflect the journey of the human soul, '
                    'the passage of time, and the subtle interplay of light and shade.'
                ),
                'founder_story_title': 'The Founder’s Artistic Journey',
                'founder_story_text': (
                    'Having dedicated decades to exploring painting and aesthetic philosophy, '
                    'Ilqar Mammadov established this platform not merely as an archive of his own masterworks, '
                    'but as a bridge connecting knowledge, art books, and creators.'
                ),
                'mission_title': 'Our Mission',
                'mission_text': (
                    'Created by founder Ilqar Mammadov to support both emerging talents taking their first steps '
                    'in fine arts and established painters. The platform offers curated digital visibility, '
                    'professional portfolios, and publishing capabilities for artworks, articles, and author books.'
                ),
                'vision_title': 'Our Vision',
                'vision_text': (
                    'To be an internationally recognized digital sanctuary celebrating authentic artistry, '
                    'protecting creator rights, and fostering meaningful connections between artists and art lovers worldwide.'
                )
            }
        )

        AboutPageTranslation.objects.update_or_create(
            about_page=about,
            language='ru',
            defaults={
                'biography_title': 'Об Ильгаре Мамедове',
                'biography_text': (
                    'Ильгар Мамедов — выдающийся азербайджанский художник, гармонично соединяющий '
                    'академические традиции живописи с глубокой философской эстетикой. В его работах свет и тень '
                    'выражают душевные искания и вечную гармонию мироздания.'
                ),
                'founder_story_title': 'История создателя',
                'founder_story_text': (
                    'Посвятив десятилетия творчеству, Ильгар Мамедов создал эту платформу, '
                    'чтобы объединить художественный архив, искусствоведческие книги и знания в едином цифровом пространстве.'
                ),
                'mission_title': 'Наша миссия',
                'mission_text': (
                    'Платформа создана основателем Ильгаром Мамедовым для всесторонней поддержки как начинающих художников, '
                    'делающих первые шаги в искусстве, так и признанных мастеров. Наша цель — предоставить профессиональное '
                    'цифровое пространство для публикации картин, статей и книг с высоким уровнем кураторского внимания.'
                ),
                'vision_title': 'Наше видение',
                'vision_text': (
                    'Стать авторитетным международным арт-пространством, бережно сохраняющим традиции и открывающим '
                    'новые горизонты для художников и коллекционеров со всего мира.'
                )
            }
        )

        # 6. Site Settings
        SiteSettings.objects.get_or_create(
            id='00000000-0000-0000-0000-000000000001',
            defaults={
                'site_title': 'İlqar Məmmədov — Rəssamlıq və Yaradıcılıq Platforması',
                'contact_email': 'art@expertvisits.com',
                'phone': '+994 50 123 45 67',
                'address': 'Bakı, Azərbaycan'
            }
        )

        self.stdout.write(self.style.SUCCESS("Initial data seeding completed successfully!"))
