# Art Experts — serverdə quraşdırma

Frontend: `https://artexperts.net`, Django API/admin: `https://app.artexperts.net`.
Docker Compose PostgreSQL, Django/Gunicorn, Next.js və Nginx-i qurur. Python, Node,
PostgreSQL və Nginx host serverdə ayrıca quraşdırılmır; Docker image-lərində gəlir.

## 1. Əvvəl yüklənəcək proqramlar və faylların köçürülməsi

Aşağıdakı ardıcıllıq boş **Ubuntu 24.04 LTS** server üçündür. `SERVER_IP` yerinə
öz serverinizin IP ünvanını yazın. Serverə root ilə daxil olmaq mümkün deyilsə,
sudo hüquqlu hesabdan istifadə edin. Hostda yalnız Docker Engine + Compose plugin
və faylları idarə etmək üçün aşağıdakı alətlər lazımdır.

Serverdə:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nano openssl
sudo mkdir -p /opt/artexperts
```

Layihə hazırda Windows kompüterinizdədirsə, **lokal PowerShell** terminalında:

```powershell
cd C:\Users\user\Desktop\Art
tar -czf "$env:TEMP/artexperts.tar.gz" --exclude=node_modules --exclude=.next --exclude=.venv --exclude=.uv-cache --exclude=.uv-python --exclude=.git --exclude=.env --exclude=.env.local --exclude=.env.production --exclude=db.sqlite3 --exclude=media --exclude=staticfiles --exclude=*.tsbuildinfo .
scp "$env:TEMP/artexperts.tar.gz" root@SERVER_IP:/tmp/artexperts.tar.gz
```

Serverdə arxivi açın və Docker-i quraşdırın:

```sh
sudo tar -xzf /tmp/artexperts.tar.gz -C /opt/artexperts
cd /opt/artexperts
sudo sh deploy/install-docker-ubuntu.sh
sudo docker version
sudo docker compose version
```

Python, pip, Node/npm, PostgreSQL, Nginx və Certbot hostda ayrıca lazım deyil;
Docker onları image-lərdə quraşdırır. Faylları Git ilə köçürürsünüzsə, real `.env`
commit edilməməlidir; `.env.example` və `.env.local.example` repoda saxlanır.

`artexperts.net` və `app.artexperts.net` DNS A qeydlərini serverin IP ünvanına yönəldin.
AAAA qeydləri varsa, onlar da həmin serverə çatmalıdır. Server/provider firewall-da
SSH üçün TCP 22, sayt və sertifikat üçün TCP 80 və 443 açıq olmalıdır.
Sertifikat alınarkən DNS serverə birbaşa çatmalıdır. 3000, 8000 və 5432 portları
yalnız Docker şəbəkəsində istifadə edilir, internetə açılmır.

## 2. Server üçün .env

```sh
cd /opt/artexperts
sudo cp -n .env.example .env
sudo chmod 600 .env
sudo nano .env
```

Quraşdırıcı [Docker-in rəsmi Ubuntu apt repository təlimatına](https://docs.docker.com/engine/install/ubuntu/) əsaslanır.
Digər Linux distributivləri üçün Docker Engine və Compose plugin-i həmin distributivin
rəsmi Docker təlimatı ilə quraşdırın, sonra aşağıdakı addımları istifadə edin.

`.env`-də `SECRET_KEY`, `DB_PASSWORD`, `RESEND_API_KEY` dəyərlərini dəyişin.
Random secret yaratmaq üçün: `openssl rand -hex 48`. `DEBUG=False` canlı server üçün
nümunə dəyəridir; `DEBUG=True` də oxunur. `DEBUG` URL-ləri və cookie ayarlarını dəyişmir.
`DB_HOST=localhost` hostda birbaşa Django işlətmək üçündür; Compose bunu `db` ilə əvəz edir.
DB_NAME və DB_USER `artexperts` qala bilər. `.env` git və Docker build context-dən çıxarılıb.

Resend hesabında domenin göndərici DNS qeydlərini təsdiqləyin və API açarını `.env`-ə
qoyun. `fake_pass` real email göndərmir. Canlı serverdə cookie/domain ayarlarını
`.env.example`-dəki kimi saxlayın; lokal `.env`-i server üçün istifadə etməyin.

## 3. Docker ardıcıllığı: build → DB → backend → frontend → Nginx → HTTPS

```sh
sudo docker compose config --quiet
sudo sh deploy/init-ssl.sh info@artexperts.net
sudo docker compose exec backend python manage.py createsuperuser
sudo docker compose ps
```

Skript əvvəlcə image-ləri build edir. PostgreSQL healthcheck uğurlu olduqdan sonra
backend başlayır, migrations və collectstatic avtomatik işləyir. Frontendin login
səhifəsi və backend API sağlamlıq yoxlamalarından keçəndə Nginx başlayır. Skript
bütün xidmətlərin hazır olmasını gözləyir, yalnız bundan sonra Certbot-u başladır.
Bu davranış [Compose --wait](https://docs.docker.com/reference/cli/docker/compose/up/) ilə qurulub.
Nginx əvvəlcə HTTP
ilə ACME challenge-ə cavab verir. Certbot iki domen üçün sertifikat alır və Nginx
restartdan sonra HTTPS və HTTP→HTTPS yönləndirməsi ilə açılır. Sertifikat alınana qədər
frontendin HTTPS API ünvanı işləməyəcək; ilk HTTP start yalnız bootstrap üçündür.
Admin: `https://app.artexperts.net/admin/`. Superuser email ilə yaradılır.

İşə düşdükdən sonra yoxlayın:

```sh
sudo docker compose exec -T backend python manage.py check --deploy
sudo docker compose exec -T nginx nginx -t
curl -I https://artexperts.net/az/login
curl -i https://app.artexperts.net/api/v1/auth/csrf/
```

Son iki sorğuda `200` gözlənilir. `check --deploy` əlavə təhlükəsizlik tövsiyələri
verə bilər; HTTPS yönləndirməsi Nginx-dədir, buna görə Django SECURE_SSL_REDIRECT
nümunədə False saxlanıb. Real email üçün browserdə qeydiyyat kodunu göndərib
təsdiqləyin, logout/login edin və şifrə bərpasını yoxlayın.

Yeni PostgreSQL bazası boş başlayır; mövcud SQLite məlumatları avtomatik köçürülmür.
Real məzmunu admindən daxil edin və ya ayrıca export/import edin. `seed_initial_data`
komandası demo hesab və nümunə məzmun yaradır; canlı bazada avtomatik çalışdırılmır.

Frontendin `NEXT_PUBLIC_*` dəyərləri build zamanı daxil edilir. Domen/API dəyişəndə:

```sh
sudo docker compose up --build --wait --wait-timeout 180
```

Backend `.env` dəyişikliklərini konteyner yenidən yaradıldıqda oxuyur:
`sudo docker compose up --force-recreate --wait --wait-timeout 180 backend`.
Nginx Docker DNS vasitəsilə dəyişən frontend/backend IP ünvanlarını avtomatik yeniləyir.

Xəta yaranarsa:

```sh
sudo docker compose ps -a
sudo docker compose logs --tail=100 db backend frontend nginx
```

Sertifikat uğursuz olarsa A/AAAA DNS və 80 portunu yoxlayın, sonra `init-ssl.sh`-i
yenidən başladın. Sertifikat alındıqdan sonra yalnız config dəyişibsə
`sudo docker compose restart nginx` istifadə etmək olar.

## 4. Boot zamanı start və sertifikat yenilənməsi

```sh
sudo cp deploy/systemd/artexperts.service /etc/systemd/system/
sudo cp deploy/systemd/artexperts-cert-renew.service /etc/systemd/system/
sudo cp deploy/systemd/artexperts-cert-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now artexperts.service artexperts-cert-renew.timer
```

Timer gündə iki dəfə Certbot renewal yoxlayır. Sertifikat dəyişəndə əvvəl Nginx
konfiqurasiyası yoxlanır, sonra xidmət dayandırılmadan reload edilir; sertifikat
dəyişməyibsə reload edilmir. [Certbot renewal sənədi](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).
Layihə qovluğu `/opt/artexperts` deyilsə systemd fayllarındakı yolları uyğunlaşdırın.
Konteynerlərdə `restart: unless-stopped` də aktivdir.

## 5. Resend və giriş

`RESEND_API_KEY` real Resend API key olmalıdır. Resend hesabında `artexperts.net`
domenini DNS qeydləri ilə təsdiqləyin və `RESEND_FROM_EMAIL=info@artexperts.net`
istifadə edin. [Resend Python təlimatı](https://resend.com/docs/send-with-python).

Email göndərilməsi bu iki axında var: qeydiyyatı təsdiqləyən 6 rəqəmli kod və şifrəni
bərpa/yeniləmə kodu. Kod 15 dəqiqə etibarlıdır, maksimum 5 səhv cəhdə icazə verilir.
Login email + şifrə ilədir. Username rəssamın ictimai profil slug-ıdır.
Parol bərpası frontenddə `/{locale}/forgot-password` səhifəsindədir.
Adi login, logout və profil yenilənməsi email göndərmir.

`DEBUG=True` və boş/`fake_pass`/`fakekey` API key birlikdə olduqda lokal nümunə kodu
cavabda göstərilir. Real key olduqda DEBUG=True olsa da Resend-ə göndərilir.
`DEBUG=False` və fake key ilə email göndərilməsi uğursuz sayılır, hesab təsdiqlənmir.

## 6. Lokal işlətmə

Root `.env` lokal nümunə kimi yaradılıb. `.env.local.example` lokal PostgreSQL/Django
ayarlarını göstərir; serverdə `.env.example`-dən ayrıca `.env` yaradın.
Frontend üçün lokal ayarlar `frontend/.env.local`-da saxlanır:

```sh
cp .env.local.example .env
cp frontend/.env.local.example frontend/.env.local
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Ayrı terminalda `cd frontend && npm ci && npm run dev`. Lokal PostgreSQL database,
user və password `.env` ilə uyğun olmalıdır. SQLite ilə lokal mövcud bazaya baxmaq üçün
`DB_ENGINE=sqlite` seçin və `DB_NAME`-i SQLite faylının tam yolu edin.

## 7. Saxlanılan məlumatlar və backup

DB, media, static və sertifikatlar Docker named volume-larında qalır.
`docker compose down` bunları saxlayır; `down -v` məlumatları silir.
PostgreSQL portu internetə açılmır. Nginx `/media/private/` yolunu bloklayır;
şəxsi kitab faylları və original əsərlər icazə yoxlayan API ilə verilir.

```sh
mkdir -p backups
sudo docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backups/database.sql
sudo docker compose logs --tail=100 backend nginx
```

Media volume-unu da DB ilə birlikdə ayrıca backup edin. Mövcud PostgreSQL volume-u
yaradıldıqdan sonra `.env`-də DB_PASSWORD dəyişməsi DB parolunu avtomatik dəyişmir;
PostgreSQL-də də eyni parol təyin edilməlidir.

## Alternativ host Gunicorn socket

İstənilən `.service` və `.socket` faylları `deploy/systemd/gunicorn.*`-dadır.
Onlar Docker-dən kənar native Django quraşdırması üçün alternativdir və Compose
quraşdırmasında aktivləşdirilmir. Native variantda Python virtualenv və PostgreSQL
hostda qurulur; `.socket` Gunicorn-a `fd://3` ötürür. Native Nginx-də backend
`proxy_pass http://unix:/run/artexperts-gunicorn.sock;` ilə göstərilir, frontend
ayrıca `127.0.0.1:3000`-da işlədilir və static/media yolları host qovluqlarına dəyişir.
Compose variantında Gunicorn daxili Docker şəbəkəsində `backend:8000`-da işləyir.
