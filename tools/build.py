import base64,subprocess,sys
SRC=sys.argv[2] if len(sys.argv)>2 else 'src/game.html'
src=open(SRC,encoding='utf8').read()
chars=set(chr(c) for c in range(0x20,0x7f))
vn="aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵđ"
for c in vn: chars.add(c); chars.add(c.upper())
for c in src:
  if ord(c)>0x7f: chars.add(c)
open('/tmp/chars.txt','w',encoding='utf8').write(''.join(sorted(chars)))
out={}
for s in ["","-Bold"]:
  subprocess.run(['pyftsubset','/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf'%s,'--text-file=/tmp/chars.txt','--output-file=/tmp/dv%s.ttf'%s,'--layout-features=*'],check=True,capture_output=True)
  out[s]=base64.b64encode(open('/tmp/dv%s.ttf'%s,'rb').read()).decode()
from fontTools.ttLib import TTFont
cm=TTFont('/tmp/dv.ttf').getBestCmap()
print('missing glyphs',[c for c in chars if ord(c) not in cm and c not in '\xa0'])
ff=('@font-face { font-family: "VNSans"; font-weight: normal; font-style: normal; src: url(data:font/truetype;base64,%s) format("truetype"); }\n'
    '@font-face { font-family: "VNSans"; font-weight: bold; font-style: normal; src: url(data:font/truetype;base64,%s) format("truetype"); }')%(out[''],out['-Bold'])
import os
kp=os.path.join(os.path.dirname(os.path.abspath(SRC)),'knight.png')
kn='data:image/png;base64,'+base64.b64encode(open(kp,'rb').read()).decode()
open(sys.argv[1],'w',encoding='utf8').write(src.replace('/*FONTS*/',ff,1).replace('__KNIGHT_PNG__',kn))
