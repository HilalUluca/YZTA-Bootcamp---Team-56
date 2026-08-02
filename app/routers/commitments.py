from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Kendi projendeki import yollarını teyit et
from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/api/commitments",
    tags=["Commitments Engine"],
    dependencies=[Depends(get_current_user)] # Veya router seviyesinde güvenlik tanımı
    )

class EvaluateRequest(BaseModel):
    success: bool

@router.post("/{commitment_id}/evaluate")
async def evaluate_commitment(
    commitment_id: str, 
    payload: EvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Kullanıcının verdiği sözün sonucunu değerlendirir ve İnfaz (Ceza/Ödül) uygular.
    Frontend'den success=false gelirse Sorumluluk Skorunu gerçek zamanlı olarak veritabanından düşürür.
    """
    
    # 1. Defansif Veri Okuma: AI profili hiç oluşmamış olabilir
    if not current_user.ai_profile:
        raise HTTPException(status_code=400, detail="Kullanıcı AI profili bulunamadı.")
        
    commitments = current_user.ai_profile.get("commitments", [])
    
    # 2. İlgili sözü bul (List comprehension yerine enumerate ile index buluyoruz ki güncelleyebilelim)
    target_index = next((index for (index, d) in enumerate(commitments) if d.get("id") == commitment_id), None)
    
    if target_index is None:
        raise HTTPException(status_code=404, detail="Sistemde böyle bir söz (commitment) bulunamadı.")
        
    target_commitment = commitments[target_index]
    
    # Kapatılmış bir söz tekrar değerlendirilemez
    if target_commitment.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Bu söz zaten infaz edilmiş.")

    # 3. Yargı ve İnfaz Mantığı
    if payload.success:
        target_commitment["status"] = "completed"
        message = "Söz tutuldu. Disiplin korundu."
    else:
        target_commitment["status"] = "failed"
        
        # Skordan cezayı kes (Defansif: eğer penalty_score yoksa varsayılan -5)
        penalty = target_commitment.get("penalty_score", -5)
        
        # Sorumluluk skorunu güncelle (Skorun eksiye düşmesini engellemek için max kullandık)
        new_score = current_user.responsibility_score + penalty
        current_user.responsibility_score = max(0.0, float(new_score))
        
        message = f"Bahaneler reddedildi. Sorumluluk skoru {penalty} puan düşürüldü."

    # 4. JSON verisini listeye geri yaz
    commitments[target_index] = target_commitment
    
    # SQLAlchemy'nin JSON kolonundaki değişimi algılaması için objeyi yeniden atıyoruz
    ai_profile_data = dict(current_user.ai_profile)
    ai_profile_data["commitments"] = commitments
    current_user.ai_profile = ai_profile_data

    # 5. Veritabanına Kaydet (Transaction)
    try:
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Veritabanı güncellenirken kritik bir hata oluştu.")
    
    return {
        "status": "success", 
        "action": "completed" if payload.success else "penalized",
        "new_score": current_user.responsibility_score,
        "message": message
    }