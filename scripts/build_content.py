"""Extract source slide text and diagrams without uploading private lecture files."""
import argparse, json, pathlib, zipfile, re, xml.etree.ElementTree as E, shutil
from slide_text import extract, tables
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-dir',type=pathlib.Path,default=pathlib.Path.home()/'Downloads')
parser.add_argument('--codes', nargs='+', help='Extract only these course codes, retaining other lectures')
args=parser.parse_args()
SOURCE=args.source_dir
selected={code.replace(' ','') for code in args.codes} if args.codes else None
N={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
config=[('Anatomy of the lower limbs.pptx','Lower Limb Anatomy','ANA 102','Anatomy','bone','peach'),('RRBN MXT 102-MEDICAL IMAGE PROCESSING.pptx','Medical Image Processing','MXT 102','Image processing','scan','mint'),('BASIC COMPUTER APPRECIATION.pptx','Computer Appreciation','MXT 304','Computing','monitor','lavender'),('LECTURES ON INTRODUCTION TO DAYLIGHT AND DIGITAL IMAGING PROCESSING.pptx','Daylight & Digital Imaging','MXT 303','Digital imaging','layers','blue'),('INTRODUCTION TO BASIC RADIOGRAPHIC EQUIPMENT.pptx','Radiographic Equipment','MXT 302','Equipment','scan','peach'),('INTRODUCTION TO AUTOMATIC FILM PROCESSING.pptx','Automatic Film Processing','MXT 205','Image processing','settings','lavender'),('RRBN MXT 202.pptx','Manual Film Processing','MXT 202','Image processing','flask','mint'),('Dr. Collins Lecture 2026-2027 First semester.pptx','Radiation Physics & Electricity','MXT 112','Physics','atom','blue'),('Anatomy of the Upper Limbs.pptx','Upper Limb Anatomy','ANA 101','Anatomy','bone','lavender'),('RRBN MXT 208.pptx','Patient Care & Health Management','MXT 208','Patient care','heart','peach'),('MXT209 RADIOGRAPHIC TECHNIQUE 2026.pptx','Radiographic Technique I: Upper Limbs','MXT 209','Technique','scan','blue'),('MXT301 Technique II 2026.pptx','Radiographic Technique II: Lower Limbs','MXT 301','Technique','bone','mint')]
notes={}
existing={d['id']:d for d in json.loads(pathlib.Path('app/data/lectures.json').read_text())} if selected else {}
lectures=[]
for i,(name,title,code,category,icon,color) in enumerate(config):
 if selected and code.replace(' ','') not in selected:
  lectures.append(existing[i]);continue
 p=SOURCE/name; z=zipfile.ZipFile(p);slides=[]; deck=f'lecture-{i+1}.pptx';shutil.copyfile(p,pathlib.Path('public/lectures')/deck)
 for n in sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+.xml$',n)],key=lambda n:int(re.search(r'slide(\d+)',n).group(1))):
  page=int(re.search(r'slide(\d+)',n).group(1));root=E.fromstring(z.read(n)); extracted=extract(root);paras=[p['text'] for p in extracted]
  images=[];rel=n.replace('slides/','slides/_rels/')+'.rels'
  if rel in z.namelist():
   for r in E.fromstring(z.read(rel)):
    if '/image' in r.attrib.get('Type',''):
     target=r.attrib['Target'];media='ppt/'+target.replace('../','')
     if media in z.namelist() and pathlib.Path(media).suffix.lower() in ['.png','.jpg','.jpeg','.gif','.svg','.webp']:
      dest=f'{i}-{pathlib.Path(media).name}';pathlib.Path('public/lecture-media',dest).write_bytes(z.read(media));images.append('/lecture-media/'+dest)
  slides.append({'page':page,'title':paras[0] if paras else f'Slide {page}','text':'\n'.join(paras),'images':list(dict.fromkeys(images)),'paragraphTexts':paras,'tableBlocks':tables(root),'richParagraphs':extracted if any(s['kind']=='math' for p in extracted for s in p['segments']) else None,'note':notes.get(i,{}).get(page)})
 lectures.append({'id':i,'name':name,'title':title,'code':code,'category':category,'icon':icon,'color':color,'file':'/lectures/'+deck,'slides':slides})
pathlib.Path('app/data/lectures.json').write_text(json.dumps(lectures,ensure_ascii=False,indent=2))
print('Extracted',sum(len(x['slides']) for x in lectures),'slides from',len(lectures),'lectures')
