// passwordHash/resetToken/tokenVersion gibi alanlar hiçbir zaman istemciye gönderilmemeli — her
// route bu satırı elle tekrarlamak yerine tek yerden geçsin diye. coachNote da burada süzülür:
// aksi halde bir öğrenci giriş yapınca/kendi profiline bakınca (bu fonksiyon /auth/login ve
// /auth/me'de kullanılıyor) koçunun kendisi hakkında tuttuğu özel notu görebilirdi — bu alan
// yalnızca routes/teacher.js > GET students/:id/overview'da, safeUser'dan GEÇMEDEN, doğrudan
// select edilerek koça döndürülür.
export function safeUser(user) {
  if (!user) return null;
  const { passwordHash, resetToken, resetTokenExpires, tokenVersion, coachNote, ...rest } = user;
  return rest;
}
