import Image from 'next/image';

const covers: Record<number, { src: string; alt: string; position?: string }> = {
  0: { src: '/images/anatomy.jpg', alt: 'Radiologist examining an X-ray', position: 'center' },
  1: { src: '/images/radiology.jpg', alt: 'Radiologist reviewing medical images' },
  2: { src: '/images/patient-care.jpg', alt: 'Medical professional using a digital device' },
  3: { src: '/images/equipment.jpg', alt: 'Digital radiography equipment' },
  4: { src: '/images/equipment.jpg', alt: 'Radiographic examination equipment', position: 'left center' },
  5: { src: '/images/radiology.jpg', alt: 'Radiographic image review', position: 'right center' },
  6: { src: '/images/anatomy.jpg', alt: 'Radiologist holding an X-ray' },
  7: { src: '/images/equipment.jpg', alt: 'Medical X-ray imaging equipment', position: 'center' },
  8: { src: '/images/anatomy.jpg', alt: 'Radiologist reviewing a chest radiograph', position: 'right center' },
  9: { src: '/images/patient-care.jpg', alt: 'Medical professional with a stethoscope' },
  10: { src: '/images/equipment.jpg', alt: 'Radiographic equipment for positioning examinations' },
  11: { src: '/images/anatomy.jpg', alt: 'Radiologist reviewing a radiograph', position: 'right center' },
};

export default function CourseCover({ lecture, code, eager = false }: { lecture: number; code: string; eager?: boolean }) {
  const cover = covers[lecture];
  // A distinct featured URL keeps Next’s development LCP tracking separate from lazy thumbnails.
  return (
    <div className={`course-cover cover-${lecture}`}>
      <Image loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} src={eager ? `${cover.src}?featured=1` : cover.src} alt={cover.alt} fill sizes={eager ? "(max-width: 600px) 95vw, (max-width: 1000px) 45vw, 420px" : "(max-width: 600px) 95vw, (max-width: 1000px) 45vw, 350px"} style={{ objectFit: 'cover', objectPosition: cover.position || 'center' }} />
      <span className="cover-shade" />
      <span className="cover-course-code">{code}</span>
      <span className="cover-format">Lecture + practice</span>
    </div>
  );
}
