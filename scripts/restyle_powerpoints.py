"""Restyle slide geometry and typography while preserving every original text run and media byte.

Requires Pillow for conservative local font measurement. Originals are never overwritten.
"""
import argparse,copy,hashlib,io,json,math,pathlib,posixpath,re,sys,zipfile
import xml.etree.ElementTree as E
from functools import lru_cache
try:
 from PIL import ImageFont
except ImportError:
 sys.path.insert(0,'/private/tmp/radia-pptx-deps')
 from PIL import ImageFont

BASE=pathlib.Path(__file__).resolve().parents[1]
NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','mc':'http://schemas.openxmlformats.org/markup-compatibility/2006','rel':'http://schemas.openxmlformats.org/package/2006/relationships'}
for prefix,uri in NS.items():
 if prefix!='rel':E.register_namespace(prefix,uri)
EMU=12700
FONT=BASE/'app/fonts/Poppins-Regular.ttf'
BOLD=BASE/'app/fonts/Poppins-SemiBold.ttf'
NAVY='243B53'; BLUE='0056D2'; MUTED='66809A'; PALE='F0F5FC'
def q(prefix,name):return '{'+NS[prefix]+'}'+name

def child(parent,tag,attrs=None,first=False):
 el=parent.find(tag,NS)
 if el is None:
  prefix,name=tag.split(':');el=E.Element(q(prefix,name),attrs or {})
  if first:parent.insert(0,el)
  else:parent.append(el)
 elif attrs:el.attrib.update(attrs)
 return el

def text(shape):return ''.join(t.text or '' for t in shape.iter() if t.tag in [q('a','t'),'{http://schemas.openxmlformats.org/officeDocument/2006/math}t'])
def paragraphs(shape):return shape.findall('.//a:p',NS)
def placeholder(shape):
 ph=shape.find('p:nvSpPr/p:nvPr/p:ph',NS)
 return ph.attrib if ph is not None else {}
def direct_rect(shape):
 if shape.tag==q('p','graphicFrame'):x=shape.find('p:xfrm',NS)
 else:x=shape.find('p:spPr/a:xfrm',NS)
 if x is None:x=shape.find('p:grpSpPr/a:xfrm',NS)
 if x is None:return None
 off=x.find('a:off',NS);ext=x.find('a:ext',NS)
 if off is None or ext is None:return None
 return tuple(int(x) for x in (off.get('x','0'),off.get('y','0'),ext.get('cx','0'),ext.get('cy','0')))
def effective_rect(shape,layout):
 rect=direct_rect(shape)
 if rect:return rect
 ph=placeholder(shape)
 if ph:
  for item in layout.findall('.//p:sp',NS):
   other=placeholder(item)
   if (ph.get('idx') is not None and other.get('idx')==ph.get('idx')) or (ph.get('type') and ph.get('type')==other.get('type')):
    rect=direct_rect(item)
    if rect:return rect
 return None

def set_rect(shape,rect):
 x,y,w,h=[int(round(v)) for v in rect]
 if shape.tag==q('p','graphicFrame'):tr=child(shape,'p:xfrm')
 elif shape.tag==q('p','grpSp'):tr=child(child(shape,'p:grpSpPr'),'a:xfrm')
 else:tr=child(child(shape,'p:spPr'),'a:xfrm',first=True)
 child(tr,'a:off',{'x':str(x),'y':str(y)})
 child(tr,'a:ext',{'cx':str(max(1,w)),'cy':str(max(1,h))})

def fill(node,color):
 for old in list(node):
  if old.tag in [q('a',name) for name in ['solidFill','noFill','gradFill','blipFill','pattFill','grpFill']]:node.remove(old)
 f=E.Element(q('a','solidFill'));E.SubElement(f,q('a','srgbClr'),{'val':color});node.insert(0,f)

@lru_cache(maxsize=256)
def font(size,bold=False):return ImageFont.truetype(str(BOLD if bold else FONT),size=max(1,int(round(size*4))))
def line_count(value,points,width):
 if not value.strip():return 1
 # Measure at 4x scale; account for explicit line breaks and long words.
 f=font(points);max_width=max(30,width)*4;count=0
 for line in value.split('\n'):
  current='';n=1
  for word in line.split():
   trial=(current+' '+word).strip()
   if f.getlength(trial)>max_width and current:n+=1;current=word
   else:current=trial
   if f.getlength(current)>max_width:
    extra=max(0,math.ceil(f.getlength(current)/max_width)-1);n+=extra;current=''
  count+=n
 return max(count,1)

def estimate(shape,points,width,spacing=4.5):
 total=0
 for p in paragraphs(shape):
  ppr=p.find('a:pPr',NS);level=int(ppr.get('lvl','0')) if ppr is not None else 0
  value=text(p)
  if not value.strip():total+=1.5;continue
  count=line_count(value,points,width-level*12)
  total+=count*points*1.18+spacing
 return total

def fit_size(shape,rect,preferred=21,minimum=12):
 _,_,w,h=rect;width=w/EMU-12;height=h/EMU-12
 value=preferred
 while value>minimum and estimate(shape,value,width)>height:value-=.5
 return value

def format_run(run,size,color=NAVY,bold=False,family='Arial'):
 run.set('sz',str(int(size*100)));run.set('b','1' if bold else '0')
 fill(run,color)
 child(run,'a:latin',{'typeface':family})
 child(run,'a:ea',{'typeface':family})
 child(run,'a:cs',{'typeface':family})

def format_shape(shape,size,color=NAVY,title=False,footer=False):
 # Body text remains Arial for robust PowerPoint portability; Poppins is used for headings.
 for body in shape.findall('.//p:txBody',NS):
  prop=child(body,'a:bodyPr',{'wrap':'square','anchor':'t','lIns':'0','rIns':'0','tIns':'0','bIns':'0'})
  for old in list(prop):
   if old.tag in [q('a','spAutoFit'),q('a','noAutofit'),q('a','normAutofit')]:prop.remove(old)
  E.SubElement(prop,q('a','normAutofit'),{'fontScale':'100000','lnSpcReduction':'0'})
 for p in paragraphs(shape):
  value=text(p)
  ppr=child(p,'a:pPr',{'algn':'l'},first=True)
  if footer:ppr.set('algn','l')
  level=int(ppr.get('lvl','0'))
  ppr.set('marL',str(level*12*EMU));ppr.set('indent','0')
  for tag in ['lnSpc','spcBef','spcAft']:
   for old in ppr.findall('a:'+tag,NS):ppr.remove(old)
  line=E.SubElement(ppr,q('a','lnSpc'));E.SubElement(line,q('a','spcPct'),{'val':'118000' if not title else '108000'})
  before=E.SubElement(ppr,q('a','spcBef'));E.SubElement(before,q('a','spcPts'),{'val':'0'})
  after=E.SubElement(ppr,q('a','spcAft'));E.SubElement(after,q('a','spcPts'),{'val':'450' if not title and not footer else '0'})
  heading=not footer and not title and 0<len(value.strip())<85 and (value.strip().endswith(':') or (value.isupper() and any(c.isalpha() for c in value)))
  run_size=size+(.5 if heading else 0)
  if not value.strip():
   run_size=1
   for item in list(line):line.remove(item)
   E.SubElement(line,q('a','spcPts'),{'val':'100'})
   after.find('a:spcPts',NS).set('val','0')
  for r in p.findall('a:r',NS)+p.findall('a:fld',NS):
   prop=child(r,'a:rPr',first=True);format_run(prop,run_size,color, title or heading,'Poppins SemiBold' if title else 'Arial')
  default=child(ppr,'a:defRPr');format_run(default,run_size,color,title or heading,'Poppins SemiBold' if title else 'Arial')
  ending=child(p,'a:endParaRPr');format_run(ending,run_size,color,title or heading,'Poppins SemiBold' if title else 'Arial')

def style_table(frame,rect):
 set_rect(frame,rect);_,_,w,h=rect
 table=frame.find('.//a:tbl',NS)
 if table is None:return
 cols=table.findall('a:tblGrid/a:gridCol',NS);old=sum(int(c.get('w','1')) for c in cols) or 1
 widths=[]
 for c in cols:
  width=w*int(c.get('w','1'))/old;c.set('w',str(int(width)));widths.append(width/EMU-12)
 rows=table.findall('a:tr',NS);size=17
 while size>10:
  needed=[]
  for row in rows:
   heights=[]
   for i,cell in enumerate(row.findall('a:tc',NS)):
    texts=[text(p) for p in cell.findall('.//a:p',NS)]
    heights.append(sum(line_count(t,size,widths[min(i,len(widths)-1)]) for t in texts)*size*1.12+9)
   needed.append(max(heights or [size+9]))
  if sum(needed)<=h/EMU:break
  size-=.5
 for row_index,(row,needed_height) in enumerate(zip(rows,needed)):
  row.set('h',str(int(h*needed_height/sum(needed))))
  for cell in row.findall('a:tc',NS):
   cp=child(cell,'a:tcPr',{'marL':str(5*EMU),'marR':str(5*EMU),'marT':str(4*EMU),'marB':str(4*EMU)})
   fill(cp,NAVY if row_index==0 else ('F1F5FB' if row_index%2 else 'FFFFFF'))
   for p in cell.findall('.//a:p',NS):
    pp=child(p,'a:pPr',{'algn':'l'},first=True)
    for r in p.findall('a:r',NS):format_run(child(r,'a:rPr',first=True),size,'FFFFFF' if row_index==0 else NAVY,row_index==0)
    format_run(child(p,'a:endParaRPr'),size,'FFFFFF' if row_index==0 else NAVY,row_index==0)
    format_run(child(pp,'a:defRPr'),size,'FFFFFF' if row_index==0 else NAVY,row_index==0)
 return size

def decoration(tree,w,h):
 # Decorative geometry only: no new text, no replacement illustrations.
 ids=[int(n.get('id','0')) for n in tree.findall('.//p:cNvPr',NS)];next_id=max(ids or [0])+1
 shape=E.Element(q('p','sp'));nv=E.SubElement(shape,q('p','nvSpPr'))
 E.SubElement(nv,q('p','cNvPr'),{'id':str(next_id),'name':'Radia accent line'})
 E.SubElement(nv,q('p','cNvSpPr'));E.SubElement(nv,q('p','nvPr'))
 props=E.SubElement(shape,q('p','spPr'));tr=E.SubElement(props,q('a','xfrm'))
 E.SubElement(tr,q('a','off'),{'x':str(int(w*.055)),'y':str(int(h*.205))})
 E.SubElement(tr,q('a','ext'),{'cx':str(int(w*.065)),'cy':str(int(h*.006))})
 geometry=E.SubElement(props,q('a','prstGeom'),{'prst':'rect'});E.SubElement(geometry,q('a','avLst'))
 fill(props,BLUE);line=E.SubElement(props,q('a','ln'));E.SubElement(line,q('a','noFill'))
 tree.insert(2,shape)

def get_layout(z,number):
 rel=f'ppt/slides/_rels/slide{number}.xml.rels'
 if rel in z.namelist():
  for item in E.fromstring(z.read(rel)):
   if item.get('Type','').endswith('/slideLayout'):
    target=posixpath.normpath(posixpath.join('ppt/slides',item.get('Target',''))).lstrip('/')
    if target in z.namelist():return E.fromstring(z.read(target))
 return E.Element('empty')

def restyle_slide(data,z,number,w,h):
 namespaces=dict(value for _,value in E.iterparse(io.BytesIO(data),events=['start-ns']))
 for prefix,uri in namespaces.items():
  if prefix and not re.fullmatch(r'ns\d+',prefix):E.register_namespace(prefix,uri)
 root=E.fromstring(data);content=root.find('p:cSld',NS);tree=content.find('p:spTree',NS);layout=get_layout(z,number)
 background=content.find('p:bg',NS)
 if background is None:background=E.Element(q('p','bg'));content.insert(0,background)
 for old in list(background):background.remove(old)
 fill(E.SubElement(background,q('p','bgPr')),'FFFFFF')
 shapes=[s for s in list(tree) if s.tag==q('p','sp') and text(s).strip()]
 footers=[];bodies=[];titles=[]
 for shape in shapes:
  value=text(shape).strip();ph=placeholder(shape)
  if ph.get('type') in ['dt','ftr','sldNum'] or re.fullmatch(r'\d{1,3}|\d{1,2}/\d{1,2}/\d{4}.*',value):footers.append(shape)
  elif ph.get('type') in ['title','ctrTitle']:titles.append(shape)
  else:bodies.append(shape)
 if not titles:
  candidates=[s for s in bodies if len(paragraphs(s))==1 and 3<len(text(s).strip())<160]
  if candidates:
   title=min(candidates,key=lambda s: len(text(s)))
   titles=[title];bodies.remove(title)
 # Preserve complex grouped shapes and alternate branches in place.
 complex_nodes=[node for node in tree if node.tag in [q('p','grpSp'),q('mc','AlternateContent')]]
 images=[node for node in tree if node.tag==q('p','pic')]
 frames=[node for node in tree if node.tag==q('p','graphicFrame')]
 margin=w*.055;body_y=h*(.255 if titles else .085);body_h=h*(.645 if titles else .815);gap=w*.032
 title_rect=(margin,h*.065,w*.89,h*.125)
 sizes=[]
 for title in titles:
  set_rect(title,title_rect);size=fit_size(title,title_rect,32 if len(text(title))<75 else 27,18);format_shape(title,size,BLUE,True);sizes.append(size)
 # Genuine photographs/diagrams are fitted without cropping or replacing their media.
 if images and (bodies or frames):
  text_rect=(margin,body_y,w*.53,body_h)
  image_rect=(w*.63,body_y,w*.315,body_h)
 else:text_rect=(margin,body_y,w*.89,body_h);image_rect=text_rect
 if bodies:
  cols=min(2,len(bodies));rows=math.ceil(len(bodies)/cols)
  if images:cols=1;rows=len(bodies)
  cell_w=(text_rect[2]-(cols-1)*gap)/cols;cell_h=(text_rect[3]-(rows-1)*h*.025)/rows
  rectangles=[]
  if cols==1 and len(bodies)>1:
   weights=[max(20,estimate(shape,18,cell_w/EMU-12)) for shape in bodies]
   available=text_rect[3]-(len(bodies)-1)*h*.025;current_y=text_rect[1]
   for weight in weights:
    height=available*weight/sum(weights);rectangles.append((text_rect[0],current_y,cell_w,height));current_y+=height+h*.025
  else:
   for i in range(len(bodies)):rectangles.append((text_rect[0]+(i%cols)*(cell_w+gap),text_rect[1]+(i//cols)*(cell_h+h*.025),cell_w,cell_h))
  common_size=min(fit_size(shape,rect,22 if len(text(shape))<450 else 20,11.5) for shape,rect in zip(bodies,rectangles))
  for shape,rect in zip(bodies,rectangles):
   set_rect(shape,rect);format_shape(shape,common_size);sizes.append(common_size)
 if frames:
  # Text and tables coexist on a few cover/summary slides. Reserve the main content area for data.
  frame_rect=text_rect
  if bodies:
   frame_rect=(text_rect[0],body_y+h*.13,text_rect[2],body_h-h*.13)
   for shape in bodies:
    rect=(text_rect[0],body_y,text_rect[2],h*.105);set_rect(shape,rect);format_shape(shape,fit_size(shape,rect,18,11.5))
  for frame in frames:
   if frame.find('.//a:tbl',NS) is not None:
    size=style_table(frame,frame_rect)
    if size:sizes.append(size)
   else:set_rect(frame,frame_rect)
 for node in complex_nodes:
  for shape in node.findall('.//p:sp',NS):
   rect=effective_rect(shape,layout) or text_rect
   size=fit_size(shape,rect,19,11.5);format_shape(shape,size);sizes.append(size)
  for frame in node.findall('.//p:graphicFrame',NS):
   if frame.find('.//a:tbl',NS) is not None:style_table(frame,direct_rect(frame) or text_rect)
 for i,image in enumerate(images):
  rect=effective_rect(image,layout) or (0,0,image_rect[2],image_rect[3])
  bx,by,bw,bh=image_rect;slot_h=(bh-(len(images)-1)*h*.02)/len(images)
  original_w,original_h=max(1,rect[2]),max(1,rect[3]);scale=min(bw/original_w,slot_h/original_h)
  iw,ih=original_w*scale,original_h*scale
  set_rect(image,(bx+(bw-iw)/2,by+i*(slot_h+h*.02)+(slot_h-ih)/2,iw,ih))
 for i,shape in enumerate(footers):
  value=text(shape).strip();right=bool(re.fullmatch(r'\d{1,3}',value))
  rect=(w*.88 if right else margin,h*.945,w*.065 if right else w*.7,h*.03)
  set_rect(shape,rect);format_shape(shape,8,MUTED,footer=True)
  if right:
   for pp in shape.findall('.//a:pPr',NS):pp.set('algn','r')
 if titles:decoration(tree,w,h)
 serialized=E.tostring(normalize_order(root),encoding='utf-8',xml_declaration=True)
 # Preserve namespace bindings referenced by mc:Ignorable and mc:Choice Requires.
 start=serialized.find(b'>')+1;root_end=serialized.find(b'>',start);opening=serialized[start:root_end]
 missing=[]
 for prefix,uri in namespaces.items():
  if prefix and (b'xmlns:'+prefix.encode()+b'=') not in opening:missing.append((' xmlns:'+prefix+'=\"'+uri+'\"').encode())
 if missing:serialized=serialized[:root_end]+b''.join(missing)+serialized[root_end:]
 return serialized,{'slide':number,'bodyTextBoxes':len(bodies),'images':len(images),'tables':len(frames),'smallestFont':min(sizes) if sizes else None}

def normalize_order(root):
 orders={
  q('a','pPr'): ['lnSpc','spcBef','spcAft','buClrTx','buClr','buSzTx','buSzPct','buSzPts','buFontTx','buFont','buNone','buAutoNum','buChar','buBlip','tabLst','defRPr','extLst'],
  q('a','rPr'): ['ln','noFill','solidFill','gradFill','blipFill','pattFill','grpFill','effectLst','effectDag','highlight','uLnTx','uLn','uFillTx','uFill','latin','ea','cs','sym','hlinkClick','hlinkMouseOver','rtl','extLst'],
  q('a','defRPr'): ['ln','noFill','solidFill','gradFill','blipFill','pattFill','grpFill','effectLst','effectDag','highlight','uLnTx','uLn','uFillTx','uFill','latin','ea','cs','sym','hlinkClick','hlinkMouseOver','rtl','extLst'],
  q('a','endParaRPr'): ['ln','noFill','solidFill','gradFill','blipFill','pattFill','grpFill','effectLst','effectDag','highlight','uLnTx','uLn','uFillTx','uFill','latin','ea','cs','sym','hlinkClick','hlinkMouseOver','rtl','extLst'],
  q('p','spPr'): ['xfrm','prstGeom','custGeom','noFill','solidFill','gradFill','blipFill','pattFill','grpFill','ln','effectLst','effectDag','scene3d','sp3d','extLst'],
  q('a','tcPr'): ['lnL','lnR','lnT','lnB','lnTlToBr','lnBlToTr','cell3D','noFill','solidFill','gradFill','blipFill','pattFill','grpFill','headers','extLst'],
  q('a','bodyPr'): ['prstTxWarp','noAutofit','normAutofit','spAutoFit','scene3d','sp3d','flatTx','extLst'],
 }
 for element in root.iter():
  if element.tag in orders:
   ordering=orders[element.tag]
   element[:]=sorted(list(element),key=lambda item:ordering.index(item.tag.split('}')[-1]) if item.tag.split('}')[-1] in ordering else len(ordering))
 return root

def text_runs(data):return [(t.tag,t.text) for t in E.fromstring(data).iter() if t.tag in [q('a','t'),'{http://schemas.openxmlformats.org/officeDocument/2006/math}t']]
def main():
 destination=BASE/'public/lectures/redesigned';destination.mkdir(parents=True,exist_ok=True)
 lectures=json.loads((BASE/'app/data/lectures.json').read_text());report=[]
 for lecture in lectures:
  source=BASE/('public'+lecture['file']);output=destination/source.name
  with zipfile.ZipFile(source) as original:
   meta=E.fromstring(original.read('ppt/presentation.xml'));size=meta.find('p:sldSz',NS);w,h=int(size.get('cx')),int(size.get('cy'));slides=[]
   with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as result:
    for info in original.infolist():
     data=original.read(info.filename)
     match=re.fullmatch(r'ppt/slides/slide(\d+)\.xml',info.filename)
     if match:
      new,layout=restyle_slide(data,original,int(match.group(1)),w,h)
      assert text_runs(data)==text_runs(new),f'Text differs in {lecture["name"]}, {info.filename}'
      data=new;slides.append(layout)
     result.writestr(copy.copy(info),data)
  with zipfile.ZipFile(source) as original,zipfile.ZipFile(output) as result:
   assert set(original.namelist())==set(result.namelist())
   for name in original.namelist():
    if re.fullmatch(r'ppt/slides/slide\d+\.xml',name):assert text_runs(original.read(name))==text_runs(result.read(name))
    else:assert original.read(name)==result.read(name),f'Non-slide content changed: {name}'
  report.append({'lecture':lecture['name'],'file':'/lectures/redesigned/'+source.name,'slides':len(slides),'verifiedTextIdentical':True,'verifiedNonSlidePartsIdentical':True,'layouts':slides})
  print(lecture['title'],len(slides),'slides: exact text and original media verified')
 (BASE/'app/data/redesign-report.json').write_text(json.dumps(report,indent=2))
 with zipfile.ZipFile(BASE/'public/lectures/radia-redesigned-lectures.zip','w',zipfile.ZIP_DEFLATED) as bundle:
  for lecture in lectures:bundle.write(destination/pathlib.Path(lecture['file']).name,lecture['name'])
  for name in ['Poppins-Regular.ttf','Poppins-SemiBold.ttf','Poppins-Bold.ttf','OFL-Poppins.txt']:
   bundle.write(BASE/'app/fonts'/name,'Fonts/'+name)
  bundle.writestr('READ ME.txt','Restyled lecture copies. All original text runs, diagrams, charts, speaker notes, media, slide count and slide numbering are preserved. Only slide typography, alignment, spacing, and decorative styling were changed. Untouched originals remain in the app. Poppins fonts are included under the Open Font License: install them for the intended heading style. Body text uses Arial for compatibility. These files have been structurally verified; no desktop PowerPoint renderer is installed in this environment.')
 print('Created 10 restyled decks and the complete download bundle.')
if __name__=='__main__':main()
