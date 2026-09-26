# Bare acts for Saarthi's knowledge base

Download each official PDF below and save it in this folder under the file name shown.
The files are not committed to git. Then build and load the corpus:

```bash
python backend/scripts/build_statute_corpus.py --out corpus.jsonl
# check the summary for missing files or ⚠ incomplete parses, then on the server:
# copy corpus.jsonl and backend/scripts/load_corpus.py into the ingestion container and run
# python /tmp/load_corpus.py /tmp/corpus.jsonl
```

| File | Act | Status | Official source |
|---|---|---|---|
| `bns.pdf` | The Bharatiya Nyaya Sanhita, 2023 (Act 45 of 2023) | In force | [link](https://www.ncrb.gov.in/uploads/SankalanPortal/DownloadPDF/BNS2023.pdf) |
| `bnss.pdf` | The Bharatiya Nagarik Suraksha Sanhita, 2023 (Act 46 of 2023) | In force | [link](https://www.ncrb.gov.in/uploads/SankalanPortal/DownloadPDF/BNSS2023.pdf) |
| `bsa.pdf` | The Bharatiya Sakshya Adhiniyam, 2023 (Act 47 of 2023) | In force | [link](https://www.ncrb.gov.in/uploads/SankalanPortal/DownloadPDF/BSA2023.pdf) |
| `ipc.pdf` | The Indian Penal Code, 1860 (Act 45 of 1860) | Replaced 1 Jul 2024 (applies to earlier matters) | [link](https://www.indiacode.nic.in/bitstream/123456789/2263/1/A1860-45.pdf) |
| `crpc.pdf` | The Code of Criminal Procedure, 1973 (Act 2 of 1974) | Replaced 1 Jul 2024 (applies to earlier matters) | [link](https://www.indiacode.nic.in/bitstream/123456789/16225/1/A1974-02.pdf) |
| `iea.pdf` | The Indian Evidence Act, 1872 (Act 1 of 1872) | Replaced 1 Jul 2024 (applies to earlier matters) | [link](https://www.indiacode.nic.in/bitstream/123456789/2188/1/A1872-1.pdf) |
| `cpc.pdf` | The Code of Civil Procedure, 1908 (Act 5 of 1908) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/2191/1/A1908-05.pdf) |
| `contract.pdf` | The Indian Contract Act, 1872 (Act 9 of 1872) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/2187/2/A187209.pdf) |
| `sra.pdf` | The Specific Relief Act, 1963 (Act 47 of 1963) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/1583/7/A1963-47.pdf) |
| `limitation.pdf` | The Limitation Act, 1963 (Act 36 of 1963) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/1565/5/A1963-36.pdf) |
| `tpa.pdf` | The Transfer of Property Act, 1882 (Act 4 of 1882) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/2338/1/A1882-04.pdf) |
| `cpa.pdf` | The Consumer Protection Act, 2019 (Act 35 of 2019) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/16939/1/a2019-35.pdf) |
| `dv.pdf` | The Protection of Women from Domestic Violence Act, 2005 (Act 43 of 2005) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/2021/5/A2005-43.pdf) |
| `pocso.pdf` | The Protection of Children from Sexual Offences Act, 2012 (Act 32 of 2012) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/9318/1/sexualoffencea2012-32.pdf) |
| `hma.pdf` | The Hindu Marriage Act, 1955 (Act 25 of 1955) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/1560/1/A1955-25.pdf) |
| `sma.pdf` | The Special Marriage Act, 1954 (Act 43 of 1954) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/1387/1/A195443.pdf) |
| `hsa.pdf` | The Hindu Succession Act, 1956 (Act 30 of 1956) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/1713/1/A1956-30.pdf) |
| `ni.pdf` | The Negotiable Instruments Act, 1881 (Act 26 of 1881) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/2189/1/A1881-26.pdf) |
| `rti.pdf` | The Right to Information Act, 2005 (Act 22 of 2005) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/2065/1/A2005-22.pdf) |
| `it.pdf` | The Information Technology Act, 2000 (Act 21 of 2000) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/1999/3/A2000-21.pdf) |
| `mv.pdf` | The Motor Vehicles Act, 1988 (Act 59 of 1988) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/1798/1/aA1988-59.pdf) |
| `rera.pdf` | The Real Estate (Regulation and Development) Act, 2016 (Act 16 of 2016) | In force | [link](https://www.indiacode.nic.in/bitstream/123456789/2158/3/A2016-16.pdf) |

India Code (indiacode.nic.in) is migrating to indiacode.gov.in and sometimes returns errors;
if a link fails, search the act on https://indiacode.gov.in and download the English PDF.
