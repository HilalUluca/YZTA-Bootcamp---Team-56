import google.generativeai as genai

# Anahtarını doğrudan tanımlıyoruz
genai.configure(api_key="AQ.Ab8RN6Jg--i6hvnuTXrfxO2BRD4KkWbAK1HUna9myV8y4TYQxg")

print("Senin API Anahtarına Özel İzin Verilen Modeller:")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print("Sorgu Hatası:", e)