const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com','10minutemail.net','10minutemail.org','20minutemail.com',
  'guerrillamail.com','guerrillamail.net','guerrillamail.org','guerrillamail.info',
  'guerrillamail.biz','guerrillamail.de','spam4.me','trashmail.com','trashmail.me',
  'trashmail.net','trashmail.at','trashmail.io','trashmail.org','mailnator.com',
  'mailinator.com','mailinator.net','maildrop.cc','throwam.com','throwam.net',
  'tempmail.com','temp-mail.org','temp-mail.io','fakeinbox.com','yopmail.com',
  'yopmail.fr','cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx',
  'mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf',
  'monmail.fr.nf','dispostable.com','sharklasers.com','guerrillamailblock.com',
  'grr.la','guerrillamail.biz','zetmail.com','spamgourmet.com','spamgourmet.net',
  'spamgourmet.org','binkmail.com','bobmail.info','letthemeatspam.com',
  'spamfree24.org','spamcero.com','amilegit.com','tmailinator.com','spamoff.de',
  'mailbucket.org','getonemail.com','nada.email','mohmal.com','harakirimail.com',
  'discard.email','getnada.com','spamex.com','dodgeit.com','spamgob.com',
  'spamhereplease.com','mailnull.com','emailondeck.com','filzmail.com',
  'spoofmail.de','e4ward.com','jetable.net','jetable.org','keepmymail.com',
  'kasmail.com','meltmail.com','incognitomail.com','throwam.com',
  'mailsiphon.com','mailnew.com','emailisvalid.com','tempe-mail.com',
  'spamfree.eu','mailkept.com','mailzilla.org','spaml.de','spamspot.com',
  'shortmail.net','mindless.com','mailme.lv','bspamfree.org','mail4trash.com',
  'spaml.com','rmqkr.net','jetable.com','uroid.com','uggsrock.com',
  'tmail.com','sogetthis.com','shieldedmail.com','shitmail.me','pimpedupmyspace.com',
  'nomail.pw','nobulk.com','no-spam.ws','no-spam.hu','namewithus.com',
  'napalm51.com','mycleaninbox.net','myspaceinc.org','myspaceinc.net',
  'mymail-in.net','mailmate.com','mailexpire.com','maildu.de','maildomino.com',
  'mailcatch.com','mail2rss.org','inoutmail.de','inoutmail.eu','inoutmail.net',
  'hulapla.de','hotpop.com','gishpuppy.com','getairmail.com','garbagemail.org',
  'fastacura.com','fakemailgenerator.com','faccesss.com','explodemail.com',
  'ephemail.net','einrot.com','dogmail.co.uk','dodgeit.com','dingbone.com',
  'devnullmail.com','despam.it','dayrep.com','da2.us','cust.in',
  'cool.fr.nf','confidential.life','cloakmail.com','classicalconvergence.com',
  'chammy.info','cc.liamg.sl','casema.nl','cashette.com','crapmail.org',
  'bum.net','bumpymail.com','bodhi.lawlita.com','bitwhites.top','bigstring.com',
  'beefmilk.com','baxomale.ht.cx','b.cr.cloudns.asia','antireg.ru',
  'antireg.com','acbd.it','abcmail.email','abcxy.com',
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return DISPOSABLE_DOMAINS.has(domain)
}
