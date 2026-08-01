import { useState, useEffect } from 'react';

export const useGunSonuZamani = (customTime?: string) => {
  const [isAfterSummaryTime, setIsAfterSummaryTime] = useState(false);

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      // YZTA: Kullanıcının belirlediği saati ileride ayarlayabilmesi için
      // bu kısmı ileride context'ten veya API'den alabiliriz.
      // Şimdilik parametre gelirse onu, gelmezse default 20:30'u kullanıyoruz.
      const timeStr = customTime || '20:30';
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      const summaryTime = new Date();
      summaryTime.setHours(hours, minutes, 0, 0);

      // Şu anki saat, belirlenen 20:30 (veya ayarlı) saatten büyük veya eşitse
      setIsAfterSummaryTime(now >= summaryTime);
    };

    // İlk kontrol
    checkTime();

    // Dakikada bir kontrol et
    const interval = setInterval(checkTime, 60000);

    return () => clearInterval(interval);
  }, [customTime]);

  return isAfterSummaryTime;
};
