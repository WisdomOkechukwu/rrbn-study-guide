"""Independent checks for original wording, equations, media and package integrity."""
import hashlib,io,json,pathlib,re,zipfile
import xml.etree.ElementTree as E
from slide_text import extract
BASE=pathlib.Path(__file__).resolve().parents[1]
A='http://schemas.openxmlformats.org/drawingml/2006/main'
M='http://schemas.openxmlformats.org/officeDocument/2006/math'
MC='http://schemas.openxmlformats.org/markup-compatibility/2006'
def signature(data):
 root=E.fromstring(data)
 return [(element.tag,element.text) for element in root.iter() if element.tag in ['{'+A+'}t','{'+M+'}t']]
def main():
 decks=json.loads((BASE/'app/data/lectures.json').read_text());counts={'decks':0,'slides':0,'textRuns':0,'mathRuns':0,'mediaParts':0,'unchangedParts':0}
 for deck in decks:
  source=BASE/('public'+deck['file']);restyled=BASE/'public/lectures/redesigned'/source.name
  downloads=pathlib.Path.home()/'Downloads'/deck['name']
  if downloads.exists():assert hashlib.sha256(source.read_bytes()).digest()==hashlib.sha256(downloads.read_bytes()).digest(),f'Original changed: {deck["name"]}'
  with zipfile.ZipFile(source) as original,zipfile.ZipFile(restyled) as changed:
   assert original.testzip() is None and changed.testzip() is None
   assert set(original.namelist())==set(changed.namelist())
   for item in original.namelist():
    before=original.read(item);after=changed.read(item)
    match=re.fullmatch(r'ppt/slides/slide(\d+)\.xml',item)
    if match:
     assert signature(before)==signature(after),f'Text/equation changed: {deck["name"]}, {item}'
     old_root=E.fromstring(before);new_root=E.fromstring(after)
     assert len(list(old_root.iter('{'+A+'}p')))==len(list(new_root.iter('{'+A+'}p'))),f'Paragraph count changed: {item}'
     bindings=dict(value for _,value in E.iterparse(io.BytesIO(after),events=['start-ns']))
     for element in new_root.iter():
      for prefix in element.get('{'+MC+'}Ignorable','').split()+element.get('Requires','').split():assert prefix in bindings,f'Unbound namespace {prefix}: {item}'
     page=int(match.group(1));extracted=extract(old_root)
     assert deck['slides'][page-1]['text']=='\n'.join(p['text'] for p in extracted),f'Reader wording mismatch: {item}'
     counts['slides']+=1;counts['textRuns']+=len(signature(before));counts['mathRuns']+=sum(tag=='{'+M+'}t' for tag,_ in signature(before))
    else:
     assert before==after,f'Non-slide package content changed: {deck["name"]}, {item}'
     counts['unchangedParts']+=1
     if item.startswith('ppt/media/'):counts['mediaParts']+=1
  counts['decks']+=1
 assert counts['decks']==len(decks) and counts['slides']==sum(len(d['slides']) for d in decks)
 assert (BASE/'public/lectures/radia-redesigned-lectures.zip').exists()
 print(json.dumps(counts))
if __name__=='__main__':main()
