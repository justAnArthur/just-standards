# Before and after

Checked 2026-11-21 12:19 UTC with 16 packs, in 33 s. Passing checks per pack; waived cells (production-only, the same for both) are not counted.

| pack | before | after |
|---|---|---|
| accessibility | 3/5 | 5/5 |
| ai-ready | 3/6 | 6/6 |
| ai-visibility | 1/4 | 4/4 |
| analytics | 0/1 | 1/1 |
| content | 4/5 | 5/5 |
| eu-consumer | 2/7 | 7/7 |
| i18n | 4/4 | 4/4 |
| local-business | 1/5 | 5/5 |
| nextjs | 13/15 | 15/15 |
| performance | 6/6 | 6/6 |
| rental | 0/5 | 5/5 |
| scanners | 4/6 | 4/6 |
| security | 2/7 | 7/7 |
| seo | 7/10 | 10/10 |
| sharing | 0/3 | 3/3 |
| website | 3/16 | 16/16 |
| **total** | **53/105** | **103/105** |

Still open on the after site:

- `scanners/html-valid` (site, fail): 16 HTML errors by validator.w3.org (/ 8, /en 8, /podmienky-prenajmu 0): /:1: The first “option” element in a “select” element with a “required” attribute, and without a “multiple” attribute, and without a “size” attr… at <option value="2026-11-21"> ×2; /:1: Bad value for attribute “srcset” on elemen
- `scanners/observatory` (site, error): Observatory scans public hosts only, not localhost
