import os
import shutil
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from users.models import User, ArtistProfile
from artworks.models import Artwork, ArtworkCategory, ArtworkTranslation, ModerationStatus
from books.models import Book, BookTranslation, BookContributor, BookContributorLink, BookCategory, AvailabilityMode, ContributorRole
from articles.models import Article, ArticleCategory, ArticleTranslation
from pages.models import HeroBanner, HeroBannerTranslation, AboutPageContent, AboutPageTranslation


class Command(BaseCommand):
    help = "Populates rich sample artworks, books, articles, artists, and media for Art Expert"

    def handle(self, *args, **options):
        self.stdout.write("Populating comprehensive Art Expert sample data and images...")

        media_root = Path(settings.MEDIA_ROOT)
        frontend_public = Path(settings.BASE_DIR).parent / 'frontend' / 'public'

        # Target media directories
        (media_root / 'founder').mkdir(parents=True, exist_ok=True)
        (media_root / 'banners').mkdir(parents=True, exist_ok=True)
        (media_root / 'artworks' / 'masters').mkdir(parents=True, exist_ok=True)
        (media_root / 'artworks' / 'details').mkdir(parents=True, exist_ok=True)
        (media_root / 'artworks' / 'thumbnails').mkdir(parents=True, exist_ok=True)
        (media_root / 'books' / 'covers').mkdir(parents=True, exist_ok=True)
        (media_root / 'private' / 'books' / 'files').mkdir(parents=True, exist_ok=True)
        (media_root / 'articles' / 'covers').mkdir(parents=True, exist_ok=True)
        (media_root / 'articles' / 'thumbnails').mkdir(parents=True, exist_ok=True)
        frontend_public.mkdir(parents=True, exist_ok=True)

        # Brain artifact directories
        prev_artifact_dir = Path(r"C:\Users\user\.gemini\antigravity-ide\brain\6d7d040b-ac87-4993-bf8f-80ceb4ccfafd")
        curr_artifact_dir = Path(r"C:\Users\user\.gemini\antigravity-ide\brain\6549e705-d3d6-447a-a5b3-4564fd3addf0")

        # 1. Source Image Files
        portrait_src = prev_artifact_dir / "ilqar_mammadov_portrait_1789728987592.jpg"
        caspian_src = prev_artifact_dir / "caspian_baku_painting_1789729007306.jpg"
        book1_src = prev_artifact_dir / "art_book_cover_1789729028594.jpg"
        banner_src = prev_artifact_dir / "hero_museum_painting_1789729049283.jpg"

        shusha_src = curr_artifact_dir / "shusha_mountains_art_1789925824734.jpg"
        pomegranate_src = curr_artifact_dir / "pomegranate_still_life_1789925839231.jpg"
        old_baku_src = curr_artifact_dir / "old_baku_alleys_1789925852934.jpg"
        khari_bulbul_src = curr_artifact_dir / "khari_bulbul_canvas_1789925869350.jpg"
        carpet_book_src = curr_artifact_dir / "azerbaijani_carpets_book_1789925920077.jpg"
        sculpture_book_src = curr_artifact_dir / "sculpture_monograph_book_1789925938129.jpg"
        logo_src = curr_artifact_dir / "art_expert_logo_1789925885896.jpg"

        # Copy Logo
        if logo_src.exists():
            shutil.copy(logo_src, frontend_public / 'art-expert-logo.png')
            shutil.copy(logo_src, frontend_public / 'art-expert-logo.jpg')

        # Copy Founder & Banner
        if portrait_src.exists():
            shutil.copy(portrait_src, media_root / 'founder' / 'ilqar_mammadov.jpg')
            shutil.copy(portrait_src, frontend_public / 'ilqar_mammadov.jpg')
            shutil.copy(portrait_src, frontend_public / 'placeholder-avatar.png')

        if banner_src.exists():
            shutil.copy(banner_src, media_root / 'banners' / 'hero_banner.jpg')
            shutil.copy(banner_src, media_root / 'founder' / 'studio_hero.jpg')
            shutil.copy(banner_src, media_root / 'articles' / 'covers' / 'art_theory.jpg')
            shutil.copy(banner_src, media_root / 'articles' / 'thumbnails' / 'art_theory.jpg')

        # Copy Artwork images
        def place_artwork_image(src, filename):
            if src.exists():
                shutil.copy(src, media_root / 'artworks' / 'masters' / filename)
                shutil.copy(src, media_root / 'artworks' / 'details' / filename)
                shutil.copy(src, media_root / 'artworks' / 'thumbnails' / filename)

        if caspian_src.exists():
            place_artwork_image(caspian_src, 'caspian_baku.jpg')
            shutil.copy(caspian_src, frontend_public / 'placeholder-art.png')

        place_artwork_image(shusha_src, 'shusha_mountains.jpg')
        place_artwork_image(pomegranate_src, 'pomegranate_still_life.jpg')
        place_artwork_image(old_baku_src, 'old_baku_alleys.jpg')
        place_artwork_image(khari_bulbul_src, 'khari_bulbul.jpg')

        # Copy Book covers
        if book1_src.exists():
            shutil.copy(book1_src, media_root / 'books' / 'covers' / 'reng_ve_isiq.jpg')
            shutil.copy(book1_src, frontend_public / 'placeholder-book.png')
        if carpet_book_src.exists():
            shutil.copy(carpet_book_src, media_root / 'books' / 'covers' / 'azerbaijani_carpets.jpg')
        if sculpture_book_src.exists():
            shutil.copy(sculpture_book_src, media_root / 'books' / 'covers' / 'sculpture_monograph.jpg')

        # Dummy sample PDF
        sample_pdf = media_root / 'private' / 'books' / 'files' / 'sample_monograph.pdf'
        if not sample_pdf.exists():
            with open(sample_pdf, 'wb') as f:
                f.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF")

        # 2. Update Hero Banner (Clean Art Expert branding, NO Ilqar Mammadov in banner)
        banner = HeroBanner.objects.first()
        if not banner:
            banner = HeroBanner.objects.create(is_active=True, cta_url='/artworks')
        banner.image = 'banners/hero_banner.jpg'
        banner.save()

        HeroBannerTranslation.objects.update_or_create(
            banner=banner, language='az',
            defaults={
                'title': 'Art Expert — Müasir və Klassik Sənət Platforması',
                'subtitle': 'Təsviri sənət əsərlərinin rəqəmsal arxivi, müəllif incəsənət kitabları və sənətkar icması üçün kurasiya olunmuş platforma.',
                'cta_text': 'Qalereyanı Kəşf Et'
            }
        )
        HeroBannerTranslation.objects.update_or_create(
            banner=banner, language='en',
            defaults={
                'title': 'Art Expert — Curated Fine Art & Publishing Platform',
                'subtitle': 'Digital archive of fine arts, author monographs, and a curated stage for emerging and master artists.',
                'cta_text': 'Explore Gallery'
            }
        )
        HeroBannerTranslation.objects.update_or_create(
            banner=banner, language='ru',
            defaults={
                'title': 'Art Expert — Кураторская Арт-платформа',
                'subtitle': 'Цифровой архив изобразительного искусства, авторские монографии и творческое пространство для художников.',
                'cta_text': 'Исследовать галерею'
            }
        )

        # 3. Create Additional Artists
        def create_or_get_artist(email, username, full_name, specialties, location, is_founder=False):
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={'is_active': True, 'is_staff': is_founder}
            )
            if not user.has_usable_password():
                user.set_password('ArtExpert2024!')
                user.save()
            profile, _ = ArtistProfile.objects.update_or_create(
                user=user,
                defaults={
                    'username': username,
                    'full_name': full_name,
                    'specialties': specialties,
                    'location': location,
                    'is_founder': is_founder,
                    'avatar': 'founder/ilqar_mammadov.jpg' if is_founder else 'placeholder-avatar.png',
                    'avatar_thumbnail': 'founder/ilqar_mammadov.jpg' if is_founder else 'placeholder-avatar.png',
                    'short_bio': f'{full_name} — Azərbaycan təsviri sənət məktəbinin istedadlı nümayəndəsi.',
                    'artist_statement': f'Sənət həyatın rəng və formalar vasitəsilə ən dərin fəlsəfi təcəssümüdür.'
                }
            )
            return user

        founder = create_or_get_artist('admin@art.az', 'ilqar-mammadov', 'İlqar Məmmədov', 'Yağlı boya, Klassik Rəssamlıq', 'Bakı, Azərbaycan', is_founder=True)
        artist_rashad = create_or_get_artist('rashad.mehdiyev@art.az', 'rashad-mehdiyev', 'Rəşad Mehdiyev', 'Yağlı boya, Monumental Rəssamlıq', 'Bakı, Azərbaycan')
        artist_aysel = create_or_get_artist('aysel.qasimova@art.az', 'aysel-qasimova', 'Aysel Qasımova', 'Heykəltəraşlıq, Keramika', 'Şuşa / Bakı')
        artist_teymur = create_or_get_artist('teymur.quliyev@art.az', 'teymur-quliyev', 'Teymur Quliyev', 'Qrafika, Akvarel', 'Gəncə, Azərbaycan')
        artist_nigar = create_or_get_artist('nigar.ismayilova@art.az', 'nigar-ismayilova', 'Nigar İsmayılova', 'İllüstrasiya, Rəqəmsal Sənət', 'Bakı, Azərbaycan')

        # 4. Ensure Categories Exist
        cat_yagli, _ = ArtworkCategory.objects.get_or_create(slug='yagli-boya', defaults={'name_az': 'Yağlı boya', 'name_en': 'Oil Painting', 'name_ru': 'Масляная живопись'})
        cat_qrafika, _ = ArtworkCategory.objects.get_or_create(slug='qrafika', defaults={'name_az': 'Qrafika', 'name_en': 'Graphics', 'name_ru': 'Графика'})
        cat_akvarel, _ = ArtworkCategory.objects.get_or_create(slug='akvarel', defaults={'name_az': 'Akvarel', 'name_en': 'Watercolor', 'name_ru': 'Акварель'})
        cat_heykel, _ = ArtworkCategory.objects.get_or_create(slug='heykeltarasliq', defaults={'name_az': 'Heykəltəraşlıq', 'name_en': 'Sculpture', 'name_ru': 'Скульптура'})
        cat_reqemsal, _ = ArtworkCategory.objects.get_or_create(slug='reqemsal-senet', defaults={'name_az': 'Rəqəmsal sənət', 'name_en': 'Digital Art', 'name_ru': 'Цифровое искусство'})

        # 5. Populate Multiple Rich Artworks
        artworks_data = [
            {
                'owner': founder,
                'attribution': 'İlqar Məmmədov',
                'category': cat_yagli,
                'is_founder_piece': True,
                'year': 2024,
                'medium': 'Yağlı boya, kətan',
                'dimensions': '150 x 110 sm',
                'image': 'artworks/masters/shusha_mountains.jpg',
                'az': {
                    'title': 'Şuşa Zirvələri və Cıdır Düzü',
                    'description': 'Səhər dumanında Şuşanın əzəmətli dağları və Cıdır Düzünün panoramik görünüşü. Təbiətin zümrüd və qızılı çalarlarının kətan üzərində lirik təsviri.'
                },
                'en': {
                    'title': 'Shusha Peaks and Jidir Duzu',
                    'description': 'Majestic morning mist over the cliffs of Shusha and the iconic Jidir Duzu plateau with emerald and gold morning light.'
                },
                'ru': {
                    'title': 'Вершины Шуши и Джыдыр Дюзю',
                    'description': 'Утренний туман над величественными горами Шуши и Джыдыр Дюзю в золотых и изумрудных лучах солнца.'
                }
            },
            {
                'owner': artist_rashad,
                'attribution': 'Rəşad Mehdiyev',
                'category': cat_yagli,
                'is_founder_piece': False,
                'year': 2023,
                'medium': 'Yağlı boya, kətan',
                'dimensions': '110 x 85 sm',
                'image': 'artworks/masters/pomegranate_still_life.jpg',
                'az': {
                    'title': 'Nar və Qədim Xalça Natürmortu',
                    'description': 'Klassik kompozisiyada qədim gümüş məcməyi üzərində çatlamış yaqut dənəli narlar və milli Qarabağ xalçası fonunda işıq-kölgə harmoniyası.'
                },
                'en': {
                    'title': 'Still Life with Pomegranates and Antique Carpet',
                    'description': 'Ruby pomegranates on an antique silver tray contrasted against a traditional Karabakh carpet backdrop with dramatic chiaroscuro.'
                },
                'ru': {
                    'title': 'Натюрморт с гранатами и старинным ковром',
                    'description': 'Рубиновые зерна спелых гранатов на старинном серебряном блюде на фоне карабахского ковра.'
                }
            },
            {
                'owner': artist_teymur,
                'attribution': 'Teymur Quliyev',
                'category': cat_akvarel,
                'is_founder_piece': False,
                'year': 2024,
                'medium': 'Akvarel, kağız',
                'dimensions': '90 x 70 sm',
                'image': 'artworks/masters/old_baku_alleys.jpg',
                'az': {
                    'title': 'İçərişəhərin Qürub Çağı',
                    'description': 'Qədim daş döşənmiş küçələr, tarixi taxta şəbəkəli eyvanlar və qürub günəşinin isti kəhrəba şüaları altında Bakının tarixi ruhu.'
                },
                'en': {
                    'title': 'Sunset in the Old City of Baku',
                    'description': 'Atmospheric cobblestone alleys of Icherisheher with carved wooden balconies illuminated by warm amber sunset hues.'
                },
                'ru': {
                    'title': 'Закат в Старом Баку',
                    'description': 'Мощеные улочки Ичери-шехер с резными балконами в теплых закатных лучах солнца.'
                }
            },
            {
                'owner': artist_aysel,
                'attribution': 'Aysel Qasımova',
                'category': cat_yagli,
                'is_founder_piece': False,
                'year': 2024,
                'medium': 'Yağlı boya, kətan',
                'dimensions': '120 x 90 sm',
                'image': 'artworks/masters/khari_bulbul.jpg',
                'az': {
                    'title': 'Qarabağ Əfsanəsi — Xarıbülbül',
                    'description': 'Səhər şehində açan zərif Xarıbülbül çiçəyi və arxa planda dumanlı Şuşa meşələri. Azadlığın və zərifliyin simvolu.'
                },
                'en': {
                    'title': 'Legend of Karabakh — Khari Bulbul',
                    'description': 'Delicate blooming Khari Bulbul flower in morning dew against misty mountain forests, an eternal symbol of grace and heritage.'
                },
                'ru': {
                    'title': 'Легенда Карабаха — Харыбюльбюль',
                    'description': 'Нежный цветок Харыбюльбюль в утренней росе на фоне туманных лесов.'
                }
            },
            {
                'owner': founder,
                'attribution': 'İlqar Məmmədov',
                'category': cat_yagli,
                'is_founder_piece': True,
                'year': 2023,
                'medium': 'Yağlı boya, kətan',
                'dimensions': '140 x 100 sm',
                'image': 'artworks/masters/caspian_baku.jpg',
                'az': {
                    'title': 'Qədim Bakı və Xəzər Sahilləri',
                    'description': 'Qız Qalası və qədim İçərişəhər divarları fonunda qürub çağı Xəzər dənizinin qızılı işıqları və dalğaların harmoniyası.'
                },
                'en': {
                    'title': 'Old Baku and Caspian Shorelines',
                    'description': 'Golden sunset reflections on the Caspian Sea with Maiden Tower and historical fortress walls of Icherisheher.'
                },
                'ru': {
                    'title': 'Старый Баку и берега Каспия',
                    'description': 'Золотые закатные отблески Каспийского моря на фоне Девичьей башни и стен Ичери-шехер.'
                }
            }
        ]

        for item in artworks_data:
            art, _ = Artwork.objects.update_or_create(
                artist_attribution=item['attribution'],
                creation_year=item['year'],
                category=item['category'],
                defaults={
                    'owner': item['owner'],
                    'is_founder_piece': item['is_founder_piece'],
                    'is_featured': True,
                    'allow_download': True,
                    'medium': item['medium'],
                    'dimensions': item['dimensions'],
                    'moderation_status': ModerationStatus.PUBLISHED,
                    'original_master': item['image'],
                    'detail_image': item['image'],
                    'thumbnail_image': item['image'],
                }
            )
            ArtworkTranslation.objects.update_or_create(
                artwork=art, language='az',
                defaults={'title': item['az']['title'], 'description': item['az']['description']}
            )
            ArtworkTranslation.objects.update_or_create(
                artwork=art, language='en',
                defaults={'title': item['en']['title'], 'description': item['en']['description']}
            )
            ArtworkTranslation.objects.update_or_create(
                artwork=art, language='ru',
                defaults={'title': item['ru']['title'], 'description': item['ru']['description']}
            )

        # 6. Populate Multiple Books
        books_data = [
            {
                'owner': founder,
                'isbn': '978-9952-00-123-4',
                'cover': 'books/covers/reng_ve_isiq.jpg',
                'pages': 320,
                'year': 2023,
                'publisher': 'Sənət Nəşriyyatı',
                'is_founder': True,
                'az': {
                    'title': 'Təsviri Sənətdə Rəng və İşıq Fəlsəfəsi',
                    'slug': 'tesviri-senetde-reng-ve-isiq-felsefesi',
                    'short': 'Rəssamlıq sənətində rəng palitrasının psixologiyası, klassik işıq-kölgə qanunları və kompozisiya sirləri.',
                    'full': 'İlqar Məmmədovun 30 ildən artıq emalatxana təcrübəsinin və dünya sənət məktəbləri araşdırmalarının nəticəsi olan monoqrafiya.'
                },
                'en': {
                    'title': 'Philosophy of Color and Light in Fine Arts',
                    'slug': 'philosophy-of-color-and-light-in-fine-arts',
                    'short': 'Color psychology in painting, classical chiaroscuro principles, and composition mastery.',
                    'full': 'A comprehensive monograph exploring three decades of studio mastery and color dynamics.'
                },
                'ru': {
                    'title': 'Философия цвета и света в изобразительном искусстве',
                    'slug': 'filosofiya-tsveta-i-sveta-v-iskusstve',
                    'short': 'Психология цвета в живописи, законы светотени и тайны гармоничной композиции.',
                    'full': 'Фундаментальная монография, исследующая законы светотени и мастерство колористики.'
                }
            },
            {
                'owner': artist_rashad,
                'isbn': '978-9952-44-556-7',
                'cover': 'books/covers/azerbaijani_carpets.jpg',
                'pages': 410,
                'year': 2024,
                'publisher': 'Azərbaycan Xalça Muzeyi Nəşri',
                'is_founder': False,
                'az': {
                    'title': 'Azərbaycan Xalça Sənəti: İlmələrin Dili və Kompozisiya',
                    'slug': 'azerbaycan-xalca-seneti-ilmelerin-dili',
                    'short': 'Qarabağ, Quba, Təbriz və Şirvan xalça məktəblərinin ornamentika semantikası, naxışların fəlsəfəsi və tarixi təkamülü.',
                    'full': 'Fundamental elmi və bədii nəşr. Xalça kompozisiyalarında qədim simvolların mənası və rəng ahəngdarlığı yüksək keyfiyyətli illüstrasiyalarla təqdim olunur.'
                },
                'en': {
                    'title': 'Azerbaijani Carpet Art: Symbolic Language of Weaving',
                    'slug': 'azerbaijani-carpet-art-symbolic-language',
                    'short': 'Ornamental semantics and historical evolution of Karabakh, Guba, Tabriz, and Shirvan carpet weaving traditions.',
                    'full': 'Authoritative museum monograph detailing the philosophical symbolism and visual symmetry of authentic Azerbaijani carpets.'
                },
                'ru': {
                    'title': 'Азербайджанское ковровое искусство: Язык орнаментов',
                    'slug': 'kovrovoe-iskusstvo-azerbaydzhana',
                    'short': 'Семантика орнаментов и эволюция карабахской, губинской и тебризской школ ковроткачества.',
                    'full': 'Фундаментальное издание, посвященное символике и колористической гармонии национальных ковров.'
                }
            },
            {
                'owner': artist_aysel,
                'isbn': '978-9952-88-912-1',
                'cover': 'books/covers/sculpture_monograph.jpg',
                'pages': 280,
                'year': 2024,
                'publisher': 'İncəsənət Akademiyası Nəşriyyatı',
                'is_founder': False,
                'az': {
                    'title': 'Müasir və Klassik Heykəltəraşlıq: Forma və Məkan',
                    'slug': 'muasir-ve-klassik-heykeltarasliq',
                    'short': 'Mərmər, tunc və qranitdə insan plastikasının ifadə vasitələri, monumental abidələrin memarlıq mühiti ilə harmoniyası.',
                    'full': 'Klassik heykəltəraşlıq ənənələrindən müasir konseptual instalyasiyalara qədər formanın məkanla dialoqunu araşdıran tədris və sənət monoqrafiyası.'
                },
                'en': {
                    'title': 'Modern and Classical Sculpture: Form and Space',
                    'slug': 'modern-and-classical-sculpture',
                    'short': 'Plasticity of human form in marble, bronze, and granite, and architectural integration of monuments.',
                    'full': 'Comprehensive study tracing spatial harmony from classical marble sculpting to contemporary installations.'
                },
                'ru': {
                    'title': 'Современная и классическая скульптура: Форма и пространство',
                    'slug': 'skulptura-forma-i-prostranstvo',
                    'short': 'Пластика человеческого тела в мраморе и бронзе, гармония монумента с архитектурным пространством.',
                    'full': 'Монография, исследующая диалог формы и пространства от античности до современных инсталляций.'
                }
            }
        ]

        book_category, _ = BookCategory.objects.get_or_create(
            slug='monoqrafiyalar',
            defaults={
                'name_az': 'Monoqrafiyalar',
                'name_en': 'Monographs',
                'name_ru': 'Монографии',
            },
        )

        for b_item in books_data:
            book, _ = Book.objects.update_or_create(
                isbn=b_item['isbn'],
                defaults={
                    'owner': b_item['owner'],
                    'category': book_category,
                    'cover_image': b_item['cover'],
                    'digital_file': 'private/books/files/sample_monograph.pdf',
                    'availability_mode': AvailabilityMode.FREE,
                    'publication_year': b_item['year'],
                    'publisher': b_item['publisher'],
                    'languages': 'AZ, EN, RU',
                    'page_count': b_item['pages'],
                    'is_featured': True,
                    'is_founder_book': b_item['is_founder'],
                    'moderation_status': ModerationStatus.PUBLISHED
                }
            )
            BookTranslation.objects.update_or_create(
                book=book, language='az',
                defaults={'title': b_item['az']['title'], 'slug': b_item['az']['slug'], 'short_description': b_item['az']['short'], 'full_description': b_item['az']['full']}
            )
            BookTranslation.objects.update_or_create(
                book=book, language='en',
                defaults={'title': b_item['en']['title'], 'slug': b_item['en']['slug'], 'short_description': b_item['en']['short'], 'full_description': b_item['en']['full']}
            )
            BookTranslation.objects.update_or_create(
                book=book, language='ru',
                defaults={'title': b_item['ru']['title'], 'slug': b_item['ru']['slug'], 'short_description': b_item['ru']['short'], 'full_description': b_item['ru']['full']}
            )

        # 7. Populate Multiple Articles
        art_theory_cat = ArticleCategory.objects.filter(slug='senet-nezeriyyesi').first()
        if not art_theory_cat:
            art_theory_cat = ArticleCategory.objects.create(
                slug='senet-nezeriyyesi',
                name_az='Sənət nəzəriyyəsi',
                name_en='Art Theory',
                name_ru='Теория искусства'
            )

        articles_data = [
            {
                'author': founder,
                'slug': 'renglerin-insanin-ruhuna-tesiri',
                'time': 6,
                'is_founder': True,
                'az': {
                    'title': 'Rənglərin İnsanın Ruhuna Təsiri və Rəssamlıq Fəlsəfəsi',
                    'excerpt': 'Hər bir rəng kətan üzərində sadəcə piqment deyil, insanın şüuraltısına xitab edən mənəvi titrəyişdir.',
                    'content': 'Rəssamlıq təkcə gördüyümüzü təkrarlamaq deyil, hiss etdiyimizi görünən etmək sənətidir. Spektral rəng keçidləri və kətanın təbii fakturası insan ruhunda dərin estetik duyğular oyadır.'
                },
                'en': {
                    'title': 'The Impact of Color on the Human Soul & Art Philosophy',
                    'excerpt': 'Every color on canvas is not merely pigment, but a spiritual resonance addressing the subconscious.',
                    'content': 'Painting is the profound craft of making the invisible visible through color harmonies and emotional authenticity.'
                },
                'ru': {
                    'title': 'Влияние цвета на человеческую душу и философия живописи',
                    'excerpt': 'Каждый цвет на холсте — это не просто пигмент, а духовный резонанс, обращающийся к душе.',
                    'content': 'Живопись делает невидимое видимым через гармонию цвета и света.'
                }
            },
            {
                'author': artist_rashad,
                'slug': 'qarabagin-reng-dunyasi-ve-ressamliq',
                'time': 8,
                'is_founder': False,
                'az': {
                    'title': 'Qarabağın Rəng Dünyası və Klassik Azərbaycan Mənzərə Məktəbi',
                    'excerpt': 'Şuşanın dağ silsilələrində işığın qırılması, meşələrin dərin zümrüd tonları və mənzərə rəssamlığında lirik realizm.',
                    'content': 'Azərbaycan təbiətinin ən zəngin koloriti məhz Qarabağ torpağında formalaşmışdır. Kətan üzərində bu atmosferi canlandırmaq üçün rəssam həm klassik ton keçidlərini, həm də daxili poetik hisslərini birləşdirməlidir.'
                },
                'en': {
                    'title': 'The Color Realm of Karabakh in Azerbaijani Landscape School',
                    'excerpt': 'Atmospheric morning light upon the ridges of Shusha, deep emerald forest greens, and lyrical realism in landscape art.',
                    'content': 'Karabakh landscapes have inspired generations of artists with unmatched chromatic depth and emotional purity.'
                },
                'ru': {
                    'title': 'Цветовая палитра Карабаха в азербайджанской пейзажной живописи',
                    'excerpt': 'Преломление света на горных хребтах Шуши, глубокие изумрудные тона и лирический реализм.',
                    'content': 'Природа Карабаха сформировала уникальную колористическую школу азербайджанских мастеров.'
                }
            },
            {
                'author': artist_nigar,
                'slug': 'muasir-dovrun-reqemsal-qalereyalari',
                'time': 5,
                'is_founder': False,
                'az': {
                    'title': 'Müasir Dövrün Rəqəmsal Qalereyaları və Sənətçilərin Hüquqları',
                    'excerpt': 'Yüksək dəqiqlikli rəqəmsal arxivləşdirmə, qoruyucu su nişanları və incəsənətin qlobal miqyasda təqdimatı.',
                    'content': 'Art Experts platforması sənət əsərlərinin müəllif hüquqlarını qorumaqla yanaşı, onları dünya sənətsevərlərinə ən yüksək standartlarla çatdırmağı hədəfləyir.'
                },
                'en': {
                    'title': 'Digital Art Galleries in the Modern Era and Creator Rights',
                    'excerpt': 'High-definition digital archiving, watermarking protection, and global reach for artists.',
                    'content': 'Art Expert ensures creator integrity while opening global visibility for emerging and established painters.'
                },
                'ru': {
                    'title': 'Цифровые галереи современной эпохи и защита прав авторов',
                    'excerpt': 'Высокоточное цифровое архивирование, защита водяными знаками и мировое признание художников.',
                    'content': 'Платформа Art Expert защищает авторские права и продвигает творчество мастеров на международном уровне.'
                }
            }
        ]

        for a_item in articles_data:
            article, _ = Article.objects.update_or_create(
                defaults={
                    'author': a_item['author'],
                    'category': art_theory_cat,
                    'cover_image': 'articles/covers/art_theory.jpg',
                    'cover_thumbnail': 'articles/thumbnails/art_theory.jpg',
                    'reading_time_minutes': a_item['time'],
                    'is_featured': True,
                    'is_founder_article': a_item['is_founder'],
                    'moderation_status': ModerationStatus.PUBLISHED
                }
            )
            ArticleTranslation.objects.update_or_create(
                article=article, language='az',
                defaults={'title': a_item['az']['title'], 'slug': a_item['slug'], 'excerpt': a_item['az']['excerpt'], 'content': a_item['az']['content']}
            )
            ArticleTranslation.objects.update_or_create(
                article=article, language='en',
                defaults={'title': a_item['en']['title'], 'slug': a_item['slug'] + '-en', 'excerpt': a_item['en']['excerpt'], 'content': a_item['en']['content']}
            )
            ArticleTranslation.objects.update_or_create(
                article=article, language='ru',
                defaults={'title': a_item['ru']['title'], 'slug': a_item['slug'] + '-ru', 'excerpt': a_item['ru']['excerpt'], 'content': a_item['ru']['content']}
            )

        self.stdout.write(self.style.SUCCESS("All rich artworks, monographs, articles, artists, and clean Art Expert banner populated successfully!"))
