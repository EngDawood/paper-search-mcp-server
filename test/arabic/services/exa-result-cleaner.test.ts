/**
 * Tests for exa-result-cleaner.ts. Fixtures are trimmed from real Exa responses
 * (ASJP, ResearchGate and Google Scholar pages for the query "التعلم العميق").
 */
import { describe, it, expect } from 'vitest';
import {
  isPaperPage, cleanTitle, cleanSnippet, extractAuthors, looksMashed, relevanceScore, processExaResults, urlKey
} from '../../../src/arabic/services/exa-result-cleaner';

const ASJP_MASHED = `: نظرياتالتعلمالمعرفية| ASJP
×#### d'une revue éléctronique
**Les revues concernées par ce tye d'integration sont les revues scientifiques publiées uniquement sous forme électronique.**
AnnulerContinuer
دراسات وأبحاث
Volume 11, Numéro 1, Pages 519-539
## : نظرياتالتعلمالمعرفيةPage de garde, sommaire et éditorial
**الكاتب :**فشار فاطمةالزهراءفشار.
### الملخصملخصالبحثباللغةالعربية: تعدالنظريةالمعرفيةمنأحدثالنظرياتالسيكولوجيةالتيحاولتأنتستفيدمنالتطوراتالحديثةفيعلومالبيداغوجياوالأعصابوالانتروبولوجيا`;

const ASJP_OK = `الذكاءات المتعددة والإستراتيجيات الحديثة في تدريسها | ASJP

مجلة دراسات في سيكولوجية الانحراف Volume 9, Numéro 1, Pages 714-730 2024-07-01

## الذكاءات المتعددة والإستراتيجيات الحديثة في تدريسها

الكاتب : شبي ايمان .

### الملخص

تعتبر نظرية الذكاءات المتعددة التي جاء بها هاورد جاردنر في كتابه أطر العقل من أحدث النظريات التربوية التي أحدثت انقلابا في طرق واستراتيجيات التدريس.`;

const RG = `(PDF) A State-of-the-Art Survey on Deep Learning Theory and Architectures
* Home
* Statistical Learning
ArticlePDF Available
# A State-of-the-Art Survey on Deep Learning Theory and Architectures
* March 2019
DOI:10.3390/electronics8030292
Authors:
Md. Zahangir Alom at University of Dayton
Md. Zahangir Alom
* University of Dayton
Tarek M. Taha
Tarek M. Taha
Tarek M. Taha
* This person is not on ResearchGate, or hasn't claimed this research yet.
Show all 10 authorsHide

Download full-text PDFRead full-text
## Abstract and Figures
In recent years, deep learning has garnered tremendous success in a variety of application domains.`;

const SCHOLAR = `View article

Loading...

The system can't perform the operation now. Try again later.

Authors

Yann LeCun, Yoshua Bengio, Geoffrey Hinton

Publication date

2015/5/28

Source

nature

Description

Deep learning allows computational models that are composed of multiple processing layers.

Total citations`;

describe('isPaperPage', () => {
  it('keeps paper pages and drops profiles, journal and home pages', () => {
    expect(isPaperPage('https://asjp.cerist.dz/en/article/82950')).toBe(true);
    expect(isPaperPage('https://asjp.cerist.dz/en/PresentationRevue/20')).toBe(false);
    expect(isPaperPage('https://scholar.google.com/citations?view_op=view_citation&user=x')).toBe(true);
    expect(isPaperPage('https://scholar.google.com/citations?hl=en&user=x')).toBe(false);
    expect(isPaperPage('https://scholar.google.com/scholar_lookup?title=Deep')).toBe(false);
    expect(isPaperPage('https://scholar.google.com/')).toBe(false);
    expect(isPaperPage('https://www.researchgate.net/publication/277411157_Deep_Learning')).toBe(true);
    expect(isPaperPage('https://www.researchgate.net/profile/Someone')).toBe(false);
    expect(isPaperPage('https://search.shamaa.org/PDF/Articles/X/y.pdf')).toBe(true);
    expect(isPaperPage('not a url')).toBe(false);
  });
});

describe('cleanTitle', () => {
  it('strips site suffixes, leading colons and (PDF) markers', () => {
    expect(cleanTitle(': نظريات التعلم المعرفية | ASJP', 'q')).toBe('نظريات التعلم المعرفية');
    expect(cleanTitle('(PDF) Derin Öğrenme', 'q')).toBe('Derin Öğrenme');
    expect(cleanTitle('إستراتيجيات التعلم | ASJP - CERIST', 'q')).toBe('إستراتيجيات التعلم');
  });
  it('falls back when the title is empty', () => {
    expect(cleanTitle(null, 'fallback')).toBe('fallback');
  });
});

describe('cleanSnippet', () => {
  it('skips ASJP modal boilerplate and returns the abstract', () => {
    const s = cleanSnippet(ASJP_OK, 'الذكاءات المتعددة والإستراتيجيات الحديثة في تدريسها')!;
    expect(s.startsWith('تعتبر نظرية الذكاءات المتعددة')).toBe(true);
    expect(s).not.toContain('Annuler');
  });
  it('returns the abstract for ResearchGate instead of the breadcrumbs', () => {
    const s = cleanSnippet(RG, 'A State-of-the-Art Survey')!;
    expect(s.startsWith('In recent years, deep learning')).toBe(true);
    expect(s).not.toContain('Statistical Learning');
  });
  it('uses the Description section for Google Scholar and drops UI strings', () => {
    const s = cleanSnippet(SCHOLAR, 'x')!;
    expect(s).toBe('Deep learning allows computational models that are composed of multiple processing layers.');
  });
  it('omits snippets whose spaces were stripped by the source page', () => {
    expect(cleanSnippet(ASJP_MASHED, 'نظريات التعلم المعرفية')).toBeUndefined();
  });
  it('truncates long snippets at a word boundary', () => {
    const long = 'word '.repeat(300);
    const s = cleanSnippet(long, 'x')!;
    expect(s.length).toBeLessThanOrEqual(404);
    expect(s.endsWith('...')).toBe(true);
  });
  it('removes leftover markdown heading markers', () => {
    expect(cleanSnippet('### اخلاص راضي جاسم الزرفي جامعة الكوفة - كلية التربية قسم العلوم', 'x')!.startsWith('اخلاص')).toBe(true);
  });
  it('returns undefined for empty input', () => {
    expect(cleanSnippet(undefined, 'x')).toBeUndefined();
    expect(cleanSnippet('', 'x')).toBeUndefined();
  });
});

describe('looksMashed', () => {
  it('flags text without spaces and accepts normal Arabic and English', () => {
    expect(looksMashed('تعدالنظريةالمعرفيةمنأحدثالنظرياتالسيكولوجيةالتيحاولتأنتستفيدمنالتطوراتالحديثة')).toBe(true);
    expect(looksMashed('تعتبر نظرية الذكاءات المتعددة التي جاء بها هاورد جاردنر في كتابه أطر العقل من أحدث النظريات')).toBe(false);
    expect(looksMashed('Deep learning allows computational models')).toBe(false);
  });
});

describe('extractAuthors', () => {
  it('ASJP: single and multiple authors', () => {
    expect(extractAuthors('https://asjp.cerist.dz/en/article/1', ASJP_OK)).toEqual(['شبي ايمان']);
    expect(extractAuthors('https://asjp.cerist.dz/en/article/1', 'الكاتب : دمان دبيح.بوالقمح محمد.حيواني صباح\n')).toEqual(['دمان دبيح', 'بوالقمح محمد', 'حيواني صباح']);
  });
  it('ResearchGate: dedupes names and removes affiliations', () => {
    expect(extractAuthors('https://www.researchgate.net/publication/1_x', RG)).toEqual(['Md. Zahangir Alom', 'Tarek M. Taha']);
  });
  it('Google Scholar: splits the Authors field', () => {
    expect(extractAuthors('https://scholar.google.com/citations?view_op=view_citation', SCHOLAR)).toEqual(['Yann LeCun', 'Yoshua Bengio', 'Geoffrey Hinton']);
  });
  it('returns [] for sources without an author block', () => {
    expect(extractAuthors('https://search.shamaa.org/PDF/x.pdf', 'text')).toEqual([]);
    expect(extractAuthors('bad url', 'text')).toEqual([]);
  });
});

describe('relevanceScore', () => {
  it('matches Arabic terms across affixes and diacritics', () => {
    expect(relevanceScore('التعلم العميق', 'استراتيجيات التعلم العميقة والسطحية')).toBe(1);
    expect(relevanceScore('التعلم العميق', 'نظريات التعلم المعرفية')).toBe(0.5);
    expect(relevanceScore('التعلم العميق', 'الذكاءات المتعددة')).toBe(0);
  });
  it('matches Latin terms case-insensitively', () => {
    expect(relevanceScore('deep learning', 'A Survey on Deep Learning')).toBe(1);
  });
});

describe('processExaResults', () => {
  const src = (u: string) => new URL(u).hostname;
  const raw = [
    { title: 'الباحث العلمي من Google', url: 'https://scholar.google.com/?hl=ar', text: '' },
    { title: 'نظريات التعلم المعرفية | ASJP', url: 'https://asjp.cerist.dz/en/article/1', text: ASJP_OK },
    { title: 'الذكاءات | ASJP', url: 'https://asjp.cerist.dz/en/article/2', text: 'x' },
    { title: 'التعلم العميق في التعليم | ASJP', url: 'https://asjp.cerist.dz/en/article/3', text: ASJP_OK },
  ];

  it('drops non-paper pages and zero-relevance hits, ranks best match first', () => {
    const out = processExaResults(raw, 'التعلم العميق', 5, src);
    expect(out.map(r => r.url)).toEqual([
      'https://asjp.cerist.dz/en/article/3',
      'https://asjp.cerist.dz/en/article/1'
    ]);
  });
  it('respects maxResults', () => {
    expect(processExaResults(raw, 'التعلم العميق', 1, src)).toHaveLength(1);
  });
  it('keeps everything when nothing matches the query (cross-language queries)', () => {
    expect(processExaResults(raw, 'zzzz qqqq', 5, src)).toHaveLength(3);
  });
  it('labels Google Scholar citation pages that have no title', () => {
    const out = processExaResults(
      [{ title: 'View article', url: 'https://scholar.google.com/citations?view_op=view_citation&user=x', text: SCHOLAR }],
      'deep learning', 5, src
    );
    expect(out[0].title).toBe('Yann LeCun, Yoshua Bengio, Geoffrey Hinton (2015) nature');
    expect(out[0].authors).toEqual(['Yann LeCun', 'Yoshua Bengio', 'Geoffrey Hinton']);
  });
});

// Trimmed from a real journals.ekb.eg page: abstract has its spaces stripped, keywords do not
const EKB = `"تطبيقات الذكاء الاصطناعى فى التعليم (المستجدات والرؤى المستقبلية): دراسة مرجعية"
# "تطبيقات الذكاءالاصطناعىفىالتعليم"
نوعالمستند: المقالةالأصلية**المؤلف**
* أمين ديابصادقعبدالموجود
* حنان الشاعر
أستاذتكنولوجياالتعليم،كليةالتربيةجامعةالأزهربالقاهرة**10.21608/jsrep.2024.361882
**المستخلص**
منبينطرقوأدواتالتعليموالتعلمتبرزتطبيقاتالذكاءالاصطناعى،التىبدأالتعليمالعالىفىاعتمادهالتحسينجودةمخرجاتالعمليةالتعليمية؛ومناقشةالتحدياتالمترتبةعلىاعتمادالذكاءالاصطناعى
**الكلمات الرئيسية**
* دراسة مرجعية
* بحث مرجعى
* الذكاء الاصطناعى
* تطبيقات
`;

describe('EKB pages', () => {
  const url = 'https://jsrep.journals.ekb.eg/article_361882.html';
  it('extracts authors from the bold author block and ignores the affiliation line', () => {
    expect(extractAuthors(url, EKB)).toEqual(['أمين ديابصادقعبدالموجود', 'حنان الشاعر']);
  });
  it('uses the keyword list when the abstract has its spaces stripped', () => {
    expect(cleanSnippet(EKB, 'x')).toBe('Keywords: دراسة مرجعية, بحث مرجعى, الذكاء الاصطناعى, تطبيقات');
  });
  it('returns nothing (not garbage) when there is neither a readable abstract nor keywords', () => {
    const noKeywords = EKB.slice(0, EKB.indexOf('**الكلمات'));
    expect(cleanSnippet(noKeywords, 'x')).toBeUndefined();
  });
  it('reads a readable abstract under a bold label', () => {
    const readable = '**المستخلص**\nتهدف هذه الدراسة إلى بيان أثر استخدام التعلم العميق في تحسين مهارات الطلاب في المرحلة الجامعية.\n**الكلمات الرئيسية**\n* تعلم';
    expect(cleanSnippet(readable, 'x')!.startsWith('تهدف هذه الدراسة')).toBe(true);
  });
  it('treats the ?lang=ar variant and www as the same article', () => {
    expect(urlKey('https://smnar.journals.ekb.eg/article_342135.html?lang=ar')).toBe(urlKey('https://smnar.journals.ekb.eg/article_342135.html'));
    expect(urlKey('https://www.democraticac.de/?p=1')).toBe(urlKey('https://democraticac.de/?p=1'));
    expect(urlKey('https://democraticac.de/?p=1')).not.toBe(urlKey('https://democraticac.de/?p=2'));
  });
  it('processExaResults returns one result for lang variants of the same article', () => {
    const out = processExaResults([
      { title: 'مقال', url: 'https://smnar.journals.ekb.eg/article_342135.html', text: EKB },
      { title: 'مقال', url: 'https://smnar.journals.ekb.eg/article_342135.html?lang=ar', text: EKB }
    ], 'الذكاء الاصطناعي', 5, u => new URL(u).hostname);
    expect(out).toHaveLength(1);
    expect(out[0].authors).toEqual(['أمين ديابصادقعبدالموجود', 'حنان الشاعر']);
  });
});

describe('EKB edge cases seen in live results', () => {
  it('strips ** and e-mail addresses from author names', () => {
    const text = '**المؤلف**\n* مدى الحربي** (mada4104@gmail.com)\n* نهى الطويرقي** (nfaltowairiki@uj.edu.sa)\nجامعة جدة';
    expect(extractAuthors('https://mfes.journals.ekb.eg/article_419104.html', text)).toEqual(['مدى الحربي', 'نهى الطويرقي']);
  });
  it('does not return the iKNiTO site header as a snippet', () => {
    const text = 'الذكاء الاصطناعيومستقبلالوظائف: دراسةتحليليةiKNiTO Journal Management System\n* All Journals\n* Agricultural Studies (92)\n* Archaeology (28)';
    expect(cleanSnippet(text, 'الذكاء الاصطناعي ومستقبل الوظائف')).toBeUndefined();
  });
  it('flags partly space-stripped text but not normal Arabic prose', () => {
    expect(looksMashed('الذكاء الاصطناعي: تطبيقاتهومخاطرهالتربوية(دراسة تحليلية) د. هبةصبحيجلالإسماعيلأستاذمساعدورئيسقسم')).toBe(true);
    expect(looksMashed('هدفت هذه الدراسة إلى التعرف على أثر استخدام تطبيقات الذكاء الاصطناعي في تنمية مهارات التفكير الناقد لدى طلاب المرحلة الثانوية')).toBe(false);
  });
});

// Trimmed from real pages returned by Exa (October 2026)
describe('source polish: DOAJ, NAJSP, eMarefa, Algerian theses', () => {
  it('strips DOAJ, NAJSP, ScienceDirect and ACM title suffixes', () => {
    expect(cleanTitle('الذكاء الاصطناعي في التعليم العالي - مراجعة منهجية – DOAJ', 'q')).toBe('الذكاء الاصطناعي في التعليم العالي - مراجعة منهجية');
    expect(cleanTitle('الذكاء الاصطناعي كسلاح ذو حدّين (SWOT) | مجلة شمال إفريقيا للنشر العلمي (NAJSP)', 'q')).toBe('الذكاء الاصطناعي كسلاح ذو حدّين (SWOT)');
    expect(cleanTitle('A survey on deep learning and its applications - ScienceDirect', 'q')).toBe('A survey on deep learning and its applications');
    expect(cleanTitle('Introduction to Deep Learning | ACM Digital Library', 'q')).toBe('Introduction to Deep Learning');
  });

  it('drops the DOAJ "Read online" label', () => {
    const text = 'الذكاء الاصطناعي في التعليم - DOAJ\n\n## Abstract\n\nRead online\n\nالأهداف: هدفت الدراسة إلى تعرف تحديات استخدام الذكاء الاصطناعي في التعليم العالي.';
    expect(cleanSnippet(text, 'الذكاء الاصطناعي في التعليم')!.startsWith('الأهداف: هدفت الدراسة')).toBe(true);
  });

  const EMAREFA = `فعالية الذكاء الاصطناعي في عملية التعليم عن بعد

### العناوين الأخرى

The effectiveness of artificial intelligence in the distance education process

### المؤلفون المشاركون

ابن زينة، كريمة مقاتلي، خديجة

### المصدر

مجلة طبنة للدراسات العلمية الأكاديمية

### رقم السجل

BIM-1751952

تهدف هذه الدراسة إلى الكشف والبحث عن أهمية وفعالية الذكاء الاصطناعي في عملية التعليم عن بعد.`;

  it('eMarefa: snippet is the abstract, not the metadata blob', () => {
    const s = cleanSnippet(EMAREFA, 'فعالية الذكاء الاصطناعي في عملية التعليم عن بعد')!;
    expect(s.startsWith('تهدف هذه الدراسة')).toBe(true);
    expect(s).not.toContain('العناوين الأخرى');
  });

  it('eMarefa: authors are kept as one entry because the pairs cannot be split reliably', () => {
    expect(extractAuthors('https://search.emarefa.net/ar/detail/BIM-1751952-x', EMAREFA)).toEqual(['ابن زينة، كريمة مقاتلي، خديجة']);
    expect(extractAuthors('https://search.emarefa.net/ar/detail/BIM-1', 'no author block')).toEqual([]);
  });

  const THESES_TITLE = 'درجة توظيف المعلمين لتطبيقات الذكاء الاصطناعي في مدارس طرطوس. "حالة دراسية: معلمو الحلقة الأولى"';
  it('theses: removes the repeated title line and the "Résumé:" label', () => {
    const text = `${THESES_TITLE}\n\n##### ${THESES_TITLE}\n\nRésumé: هدف البحث الحالي إلى تقييم مدى توظيف معلمي الحلقة الأولى لتطبيقات الذكاء الاصطناعي.`;
    const s = cleanSnippet(text, THESES_TITLE)!;
    expect(s.startsWith('هدف البحث الحالي')).toBe(true);
  });

  it('theses: removes a leading university line before the label', () => {
    const text = 'Université Abou El Kacem Saâdallah - Alger 2 Résumé: الملخص: يدخل الذكاء الاصطناعي في كافة المجالات المعرفية بصور متباينة.';
    expect(cleanSnippet(text, 'x')!.startsWith('يدخل الذكاء الاصطناعي')).toBe(true);
  });
});

describe('eMarefa and ScienceDirect edge cases seen live', () => {
  it('eMarefa: abstract directly after the record-number heading keeps its first line', () => {
    const text = '### رقم السجل\n\nتهدف هذه الورقة إلى الكشف عن استخدام تكنولوجيا الذكاء الاصطناعي في التعليم وتحديد الإطار الأخلاقي لاستخدامه.';
    expect(cleanSnippet(text, 'x')!.startsWith('تهدف هذه الورقة')).toBe(true);
  });
  it('eMarefa: strips a leading "الملخص:" label', () => {
    const text = '### رقم السجل\n\nالملخص: يشهد العالم تحولا جوهريا مدفوعا بالتقدم في الذكاء الصناعي في قطاع التعليم.';
    expect(cleanSnippet(text, 'x')!.startsWith('يشهد العالم')).toBe(true);
  });
  it('eMarefa: single-author records use the "### المؤلف" heading', () => {
    const text = '### المؤلف\n\nاللحياني، سلطان محمد هلال \n\n### المصدر\n\nمجلة القنطار';
    expect(extractAuthors('https://search.emarefa.net/ar/detail/BIM-1', text)).toEqual(['اللحياني، سلطان محمد هلال']);
  });
  it('ScienceDirect: does not return the site navigation as a snippet', () => {
    const text = 'Deep learning: Historical overview - ScienceDirect\nSkip to main contentSkip to article\nElsevier logoScienceDirect\nMy account\nSign in\n## Outline\n1. Highlights\n2. Abstract';
    expect(cleanSnippet(text, 'Deep learning: Historical overview')).toBeUndefined();
  });
  it('ScienceDirect: still returns the abstract when it is reachable', () => {
    const text = 'Skip to main content\n## Abstract\nDeep learning has transformed many fields of research, and this review surveys its history and applications.';
    expect(cleanSnippet(text, 'x')!.startsWith('Deep learning has transformed')).toBe(true);
  });
});
