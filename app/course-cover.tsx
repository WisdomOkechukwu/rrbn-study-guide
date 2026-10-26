import Image from 'next/image';

import covers from './data/image-credits.json';

export default function CourseCover({ lecture, code, eager = false }: { lecture: number; code: string; eager?: boolean }) {
  const cover = covers[lecture];
  // A distinct featured URL keeps Next’s development LCP tracking separate from lazy thumbnails.
  return (
    <div className={`course-cover cover-${lecture}`}>
      <Image loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} src={eager ? `${cover.file}?featured=1` : cover.file} alt={cover.alt} fill sizes={eager ? "(max-width: 600px) 95vw, (max-width: 1000px) 45vw, 420px" : "(max-width: 600px) 95vw, (max-width: 1000px) 45vw, 350px"} style={{ objectFit: 'cover', objectPosition: cover.position || 'center' }} />
      <span className="cover-shade" />
      <span className="cover-course-code">{code}</span>
      <span className="cover-format">Lecture + practice</span>
    </div>
  );
}
