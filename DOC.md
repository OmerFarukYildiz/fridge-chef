# Proje Dokümantasyonu: "Şefin Gözü" (Akıllı Tarif Asistanı)

## 1. Proje Özeti
Kullanıcıların evlerindeki mevcut malzemelerin fotoğrafını çekerek veya galerilerinden yükleyerek saniyeler içinde bu malzemelerle yapılabilecek yemek tarifleri almalarını sağlayan, yapay zeka destekli bir mobil uygulamadır.

## 2. Amaç ve Kapsam
* **Amaç:** Evdeki malzemeleri değerlendirerek gıda israfını önlemek, "Ne pişirsem?" derdine son vermek ve kullanıcılara pratik mutfak çözümleri sunmak.
* **Kapsam:** Kullanıcıdan görsel girdi alınması, bu girdinin Google Gemini API'ye iletilmesi, dönen tarifin ayrıştırılması (parsing) ve kullanıcı dostu bir arayüzle sunulması. (Kullanıcı girişi, favorilere ekleme gibi özellikler ilk sürümde kapsam dışı tutulabilir, ancak v2 için planlanabilir).

## 3. Teknoloji Yığını
* **Mobil Geliştirme Ortamı:** React Native & Expo (Hızlı prototipleme ve kolay donanım erişimi için).
* **Programlama Dili:** JavaScript / TypeScript.
* **Yapay Zeka (LLM):** Google Gemini API (Görsel işleme yeteneği yüksek ve hızlı olduğu için *Gemini 1.5 Flash* veya *Gemini Pro Vision* modeli).
* **Kamera ve Medya İşlemleri:** `expo-camera`, `expo-image-picker`.
* **Yönlendirme (Routing):** `@react-navigation/native` (Stack Navigator).
* **Ağ İstekleri:** `axios` veya yerleşik `fetch` API.

## 4. Sistem Mimarisi ve Veri Akışı
1.  **Girdi Aşaması:** Kullanıcı `expo-camera` ile fotoğraf çeker veya `expo-image-picker` ile galeriden seçer.
2.  **Hazırlık Aşaması:** Seçilen görsel, API'nin okuyabilmesi için `base64` formatına çevrilir.
3.  **İstek (Request) Aşaması:** Hazırlanan görsel ve özel bir Prompt (İstem), Gemini API'ye gönderilir.
4.  **İşleme (Processing):** Gemini modeli görseldeki malzemeleri analiz eder ve prompt kurallarına uygun bir tarif oluşturur.
5.  **Yanıt (Response) ve Gösterim:** Dönen JSON formatındaki yanıt uygulamada karşılanır, ayrıştırılır ve UI bileşenlerine (başlık, malzemeler, yapılış adımları) dağıtılarak ekrana çizilir.

## 5. Kritik İstek (Prompt) Tasarımı
Başarılı bir UI için yapay zekaya gönderilecek komutun çok net olması gerekir. Örnek bir sistem komutu:

> *"Sen uzman bir aşçısın. Sana gönderilen fotoğraftaki yenilebilir malzemeleri analiz et. Bu malzemelerin ağırlıklı olduğu, lezzetli ve pratik BİR adet yemek tarifi oluştur. Yanıtını kesinlikle aşağıdaki JSON formatında ver, ekstra hiçbir metin ekleme:*
> `{ "tarifAdi": "...", "hazirlikSuresi": "...", "kaloriTahmini": "...", "kullanilanMalzemeler": ["...", "..."], "adimAdimYapilisi": ["...", "..."] }`"

## 6. Uygulama Ekranları (UI Mimarisi)
* **Ana Ekran (Home Screen):** * Hoş geldin mesajı ve kısa bir açıklama.
    * Büyük ve davetkar iki buton: "Fotoğraf Çek" 📸 ve "Galeriden Seç" 🖼️.
* **Kamera Ekranı (Camera View):** * Tam ekran kamera önizlemesi. 
    * Deklanşör butonu ve flaş/kamera çevirme kontrolleri.
* **Yükleniyor Ekranı (Loading State):** * API yanıtı 3-5 saniye sürebilir. Bu sırada kullanıcıyı sıkmamak için bir Lottie animasyonu (örneğin kaynayan bir tencere veya doğranan havuçlar) ve "Şef malzemeleri inceliyor..." gibi eğlenceli metinler gösterilmelidir.
* **Tarif Ekranı (Recipe Result Screen):** * En üstte tarifin adı.
    * Hemen altında rozetler (Badges) halinde "Hazırlık Süresi" ve "Kalori".
    * Check-box listesi şeklinde "Malzemeler" (Kullanıcı sahip olduklarına tik atabilir).
    * Kartlar halinde yatay kaydırılabilir veya alt alta liste şeklinde "Adım Adım Yapılışı".
    * En altta "Yeni Fotoğraf Çek" veya "Ana Menüye Dön" butonu.

## 7. Geliştirme Yol Haritası (Roadmap)
* **1. Aşama:** Expo projesinin başlatılması ve klasör mimarisinin kurulması (`components`, `screens`, `services`, `utils`).
* **2. Aşama:** Navigasyonun (React Navigation) kurulması ve boş ekranların bağlanması.
* **3. Aşama:** Expo Camera ve Image Picker entegrasyonu (İzinlerin ayarlanması ve görselin base64 olarak alınabilmesi).
* **4. Aşama:** Google AI Studio üzerinden API key alınması ve Gemini API bağlantısının yazılması (`services/geminiService.js`).
* **5. Aşama:** Prompt mühendisliğinin yapılması ve dönen mock (sahte) JSON verisi ile arayüzün (UI) tasarlanması.
* **6. Aşama:** Canlı API testi, hata yakalama (Error Handling - "Fotoğrafta yiyecek bulunamadı" gibi durumlar için uyarılar) ve Loading animasyonlarının eklenmesi.

uygulamayı ayaga kaldırmak icin 
cd "projenin ismi" (.\fridge-chef\)
npx expo start





