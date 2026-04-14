# Voices of the Court 2.0 - Community Edition (VOTC-CE)

Karakterleri, komploları ve hikaye akışlarını takip etmenize yardımcı olan, Crusader Kings III için yapay zeka destekli bir yardımcı uygulama. Voices of the Court 2.0 - Community Edition, Büyük Dil Modellerini (LLM) oyuna entegre ederek karakterlerle doğal sohbetler kurmanıza ve oyun durumunu dinamik olarak etkilemenize olanak tanır.

Dokümantasyon: https://docs.voicesofthecourt.app

[Steam Sayfası](https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139)

Discord Sunucumuza Katılın:

[![Discord Server](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/UQpE4mJSqZ)

# Fragman Videosu
[![link to](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# DaFloove tarafından Gameplay Videosu
[![link to](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

### 🌟 Özellikler

### 🎮 Yapılandırma Arayüzü
- **🤖 Çoklu Yapay Zeka Modelleri**: OpenAI GPT modelleri, Anthropic Claude, Player2 ve yerel modeller (Local LLMs) için destek.
- **🧠 Karakter Hafızası**: Karakter ilişkilerini ve geçmişini takip eden kalıcı hafıza sistemi.
- **📚 Bağlam Yönetimi**: Ayarlanabilir bağlam penceresi ve konuşma geçmişi ayarları.
- **🎯 Özel Komutlar (Prompts)**: Farklı karakter tipleri için kişiselleştirilmiş sistem komutları.
- **🔄 Varsayılanlara Dön**: Varsayılan komutlara ve ayarlara tek tıkla geri yükleme.

### 💬 Sohbet Arayüzü
- **⚡ Gerçek Zamanlı Konuşmalar**: CK3 karakterleriyle doğal diyaloglar.
- **👤 Karakter Profilleri**: Her karakter hakkında detaylı bilgiler.
- **🔖 Yer İşareti Sistemi**: Önemli konuşmaları kaydedin ve düzenleyin.
- **📤 Dışa Aktarma İşlevi**: Konuşmaları metin dosyası olarak dışa aktarın.

### 📋 Özet Yöneticisi
- **🤖 Otomatik Özetler**: Önemli olayların yapay zeka tarafından oluşturulan özetleri.
- **🔖 Yer İşareti Entegrasyonu**: Yer işaretlerini özetlere dönüştürün.
- **🔍 Arama İşlevi**: Belirli konuşmaları ve özetleri bulun.
- **📤 Dışa Aktarma Seçenekleri**: Özetleri çeşitli formatlarda kaydedin.

## Yapılandırma Arayüzü Detayları

Uygulama, her biri farklı işlevsel ayarlardan sorumlu olan altı ana yapılandırma sayfası sunar:

### 1. Bağlantı Sayfası (Connection)

Bağlantı sayfası, dil modeli API'sine olan bağlantıyı ve oyun yolu ayarlarını yapılandırmak için kullanılır.

- **API Bağlantı Yapılandırması**:
    - Metin oluşturma API sağlayıcısını seçin (örn. OpenAI, Kobold, vb.).
    - API anahtarını, uç nokta (endpoint) URL'sini ve model adını yapılandırın.

- **CK3 Kullanıcı Klasörü Yolu**:
    - Kullanıcı verilerinin saklandığı CK3 klasör yolunu ayarlayın.
    - Varsayılan yol: `Belgelerim/Paradox Interactive/Crusader Kings III`.
    - "Klasör Seç" düğmesi aracılığıyla doğru yolu tarayıp seçebilirsiniz.

### 2. Eylemler Sayfası (Actions)

Eylemler sayfası, oyunda algılanabilir eylemleri ve bunlara karşılık gelen yapay zeka yanıtlarını yapılandırmak için kullanılır.

- **Eylemleri Etkinleştir**:
    - Eylem algılamanın etkin olup olmadığını kontrol eden ana anahtar.
    - Yapay Zeka Anlatısını Etkinleştir: Bir eylem tetiklendikten sonra yapay zeka tarafından anlatısal açıklamalar oluşturur.

- **API Yapılandırması**:
    - Bağlantı sayfasıyla aynı API ayarlarını kullanmayı seçin veya eylem özellikleri için ayrı bir API yapılandırın.

- **Parametre Ayarları**:
    - **Temperature**: Yapay zeka yanıt yaratıcılığını kontrol eder (varsayılan 0.2).
    - **Frequency Penalty**: Tekrarlayan içerik oluşumunu azaltır.
    - **Presence Penalty**: Yeni konular hakkında konuşmayı teşvik eder.
    - **Top P**: Kelime seçimi çeşitliliğini kontrol eder.

- **Eylem Seçimi**:
    - Modun listeden algılamasını istediğiniz eylem türlerini seçin.
    - "Dosyaları Yeniden Yükle" düğmesiyle eylem listesini yenileyin.
    - "Klasörü Aç" düğmesiyle özel eylem betiklerine erişin.

### 3. Özetleme Sayfası (Summarization)

Özetleme sayfası, konuşma özeti özelliği için API ayarlarını yapılandırmak için kullanılır.

- **Özellik Amacı**: Uzun konuşmaları kısa özetlere dönüştürerek konuşma bağlamını token sınırları içinde tutmaya ve ileride başvurmak üzere kayıt oluşturmaya yardımcı olur.

### 4. Komutlar Sayfası (Prompts)

- **Ana Komutlar**:
    - **Main Prompt**: Yapay zekanın nasıl yanıt vereceğini kontrol eden temel talimatlar.
    - **Self-talk Prompt**: Karakter iç monologları için oluşturma kuralları.
    - **Memory Prompt**: Karakterlerin geçmiş olayları nasıl hatırlayacağı.
    - **Suffix Prompt**: Yanıtları biçimlendirmek için kullanılan son sistem mesajı.

### 5. Ayarlar Sayfası (Settings)

- **Temel Ayarlar**:
    - **Max New Tokens**: Tek bir yapay zeka yanıtının maksimum uzunluğunu sınırlar.
    - **Streaming Messages**: Yapay zeka üretiminin gerçek zamanlı gösterimini etkinleştirir.
    - **Validate Character Identity**: Yapay zekanın diğer karakterler adına yanıt vermesini engeller.

- **Yerleştirme Derinliği (Insertion Depth)**: Özetlerin, hafızaların ve karakter açıklamalarının konuşma geçmişindeki konumunu kontrol eder.

### 6. Sistem Sayfası (System)

- **Güncelleme**: Mevcut sürümü görüntüler ve güncellemeleri kontrol eder.
- **Günlük Dosyaları (Logs)**: Hata durumunda günlük dosyalarına erişim sağlar.

## 🚀 Yerel Kurulum

### 📥 Kurulum

**Windows**
1. En son sürümden `.exe` yükleyicisini indirin ve çalıştırın.

**macOS**
1. `.dmg` veya `.zip` dosyasını indirin.
2. Uygulama simgesini Uygulamalar klasörüne sürükleyin.
3. **Önemli**: İlk kez çalıştırırken sağ tıklayıp "Aç" (Open) seçeneğini seçerek Gatekeeper güvenliğini baypas edin.

**CK3 Mod Kurulumu**
1. Mod dosyalarını indirin ve `Documents/Paradox Interactive/Crusader Kings III/mod` klasörüne çıkarın.
2. CK3 başlatıcısında "Voices of the Court" modunu etkinleştirin.

## 🛠️ Sorun Giderme

- **Uygulama Başlamıyor**: `npm install` ile bağımlılıkları kontrol edin.
- **Bağlantı Sorunu**: API anahtarınızı ve internet bağlantınızı kontrol edin.
- **Performans**: Bağlam penceresini (context window) küçültün.

## 🤝 Katkıda Bulunma

1. Bu depoyu çatallayın (Fork).
2. Özellik dalınızı oluşturun (`git checkout -b feature/AmazingFeature`).
3. Değişikliklerinizi kaydedin (`git commit -m 'Add some AmazingFeature'`).
4. Çekme İsteği (Pull Request) açın.

### 🛠️ Yerel Geliştirme

- Bağımlılıkları yükle: `npm i`
- Geliştirme modu: `npm run start`
- Paketleme: `npm run make`

## Emeği Geçenler ve Atıflar

Bu proje, **VOTC / AliChat** tabanlı bir türev çalışmadır. Orijinal VOTC ve VOTC 2.0 ekiplerine, Çinli geliştirme topluluğuna (Lisiyuan233, zhaowendao2005 vb.) ve tüm Community Edition bakımcılarına teşekkür ederiz.

### Lisans
Bu proje **GNU Genel Kamu Lisansı v3.0 (GPLv3)** altında lisanslanmıştır. Orijinal materyallerin bir kısmı CC BY-SA 4.0 altında sunulduğu için, bu türev çalışma da uyumlu olan GPLv3 ile lisanslanmaya devam etmektedir.