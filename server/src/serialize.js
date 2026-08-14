// passwordHash/resetToken/tokenVersion gibi alanlar hiçbir zaman istemciye gönderilmemeli — her
// route bu satırı elle tekrarlamak yerine tek yerden geçsin diye.
export function safeUser(user) {
  if (!user) return null;
  const { passwordHash, resetToken, resetTokenExpires, tokenVersion, ...rest } = user;
  return rest;
}
