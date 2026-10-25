"""Read visible DrawingML and Office Math without rewriting source wording."""
import html,xml.etree.ElementTree as E
A='http://schemas.openxmlformats.org/drawingml/2006/main'
M='http://schemas.openxmlformats.org/officeDocument/2006/math'
MC='http://schemas.openxmlformats.org/markup-compatibility/2006'

def visible(element):
 if element.tag=='{'+MC+'}AlternateContent':
  choice=next((e for e in element if e.tag=='{'+MC+'}Choice'),None)
  if choice is None:choice=next(iter(element),None)
  if choice is not None:yield from visible(choice)
  return
 yield element
 for item in element:yield from visible(item)

def raw_text(element):return ''.join(e.text or '' for e in visible(element) if e.tag in ['{'+A+'}t','{'+M+'}t'])
def local(element):return element.tag.split('}')[-1]
def get(element,name):return element.find('{'+M+'}'+name)
def inner(element):return ''.join(to_mathml(c) for c in element) if element is not None else '<mrow/>'
def wrapped(element):return '<mrow>'+inner(element)+'</mrow>'
def to_mathml(element):
 name=local(element)
 if name.endswith('Pr') or name in ['ctrlPr','rPr','argPr']:return ''
 if name=='t':return '<mtext>'+html.escape(element.text or '')+'</mtext>'
 if name=='sSup':return '<msup>'+wrapped(get(element,'e'))+wrapped(get(element,'sup'))+'</msup>'
 if name=='sSub':return '<msub>'+wrapped(get(element,'e'))+wrapped(get(element,'sub'))+'</msub>'
 if name=='sSubSup':return '<msubsup>'+wrapped(get(element,'e'))+wrapped(get(element,'sub'))+wrapped(get(element,'sup'))+'</msubsup>'
 if name=='f':return '<mfrac>'+wrapped(get(element,'num'))+wrapped(get(element,'den'))+'</mfrac>'
 if name=='rad':
  deg=get(element,'deg')
  return '<mroot>'+wrapped(get(element,'e'))+wrapped(deg)+'</mroot>' if deg is not None and raw_text(deg) else '<msqrt>'+inner(get(element,'e'))+'</msqrt>'
 if name=='limLow':return '<munder>'+wrapped(get(element,'e'))+wrapped(get(element,'lim'))+'</munder>'
 if name=='limUpp':return '<mover>'+wrapped(get(element,'e'))+wrapped(get(element,'lim'))+'</mover>'
 if name=='d':
  props=get(element,'dPr');left='(';right=')'
  if props is not None:
   beg=get(props,'begChr');end=get(props,'endChr')
   if beg is not None:left=beg.get('{'+M+'}val','(')
   if end is not None:right=end.get('{'+M+'}val',')')
  return '<mrow><mo>'+html.escape(left)+'</mo>'+''.join(wrapped(e) for e in element if local(e)=='e')+'<mo>'+html.escape(right)+'</mo></mrow>'
 return inner(element)

def math_plain(element):
 name=local(element)
 if name.endswith('Pr') or name in ['ctrlPr','rPr','argPr']:return ''
 if name=='t':return element.text or ''
 if name=='sSup':return math_plain(get(element,'e'))+'^('+math_plain(get(element,'sup'))+')'
 if name=='sSub':return math_plain(get(element,'e'))+'_('+math_plain(get(element,'sub'))+')'
 if name=='f':return '('+math_plain(get(element,'num'))+')/('+math_plain(get(element,'den'))+')'
 return ''.join(math_plain(e) for e in element) if element is not None else ''

def extract(root):
 paragraphs=[]
 for paragraph in visible(root):
  if paragraph.tag!='{'+A+'}p':continue
  segments=[]
  def visit(node):
   if node.tag=='{'+M+'}oMath':
    segments.append({'kind':'math','text':raw_text(node),'plain':math_plain(node),'mathml':'<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">'+wrapped(node)+'</math>'});return
   if node.tag=='{'+A+'}t':segments.append({'kind':'text','text':node.text or ''});return
   if node.tag=='{'+A+'}br':segments.append({'kind':'text','text':'\n'});return
   for item in node:visit(item)
  visit(paragraph)
  value=''.join(s.get('plain',s['text']) for s in segments).strip()
  if value:paragraphs.append({'text':value,'segments':segments})
 return paragraphs

def tables(root):
 """Keep genuine slide tables structured and map them to the paragraph stream."""
 result=[];cursor=0
 def walk(node):
  nonlocal cursor
  if node.tag=='{'+MC+'}AlternateContent':
   branch=next((e for e in node if e.tag=='{'+MC+'}Choice'),None)
   if branch is None:branch=next(iter(node),None)
   if branch is not None:walk(branch)
   return
  if node.tag=='{'+A+'}tbl':
   start=cursor;rows=[]
   for row in node.findall('{'+A+'}tr'):
    cells=[]
    for cell in row.findall('{'+A+'}tc'):
     content=extract(cell);cursor+=len(content)
     cells.append({'paragraphs':content,'colSpan':int(cell.get('gridSpan','1')),'rowSpan':int(cell.get('rowSpan','1')),'continuation':(cell.get('hMerge')=='1' or cell.get('vMerge')=='1') and not content})
    rows.append(cells)
   result.append({'start':start,'end':cursor,'rows':rows});return
  if node.tag=='{'+A+'}p':
   if extract(node):cursor+=1
   return
  for item in node:walk(item)
 walk(root)
 return result
