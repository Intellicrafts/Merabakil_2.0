"""Punjab & Haryana: parsing BCPH's published lists, the index, and verification."""

import asyncio

import pytest

from app.services.roll_index import punjab_haryana as ph
from app.services.scrapers.punjab_haryana_verifier import PunjabHaryanaVerifier


def _words(*lines):
    """pdfplumber-style words from (top, [(x0, text), ...]) lines."""
    return [{"top": top, "x0": x, "text": t} for top, items in lines for x, t in items]


# Column positions measured from the real State Roll PDF (Oct 2023 edition).
ROLL_PAGE = _words(
    (10, [(200, "District/Sub"), (260, "Division")]),
    (40, [(25, "Sr.No."), (58, "No."), (73, "on"), (101, "State"), (141, "Name"), (166, "of"), (265, "Address"),
          (497, "Station/Place"), (599, "District"), (702, "State")]),
    (48, [(58, "Roll"), (141, "Roll")]),
    (60, [(30, "65316"), (58, "P/1150/1993"), (141, "MANDEEP"), (182, "KAUR"), (265, "H."), (276, "NO."),
          (292, "5054,"), (497, "ROPAR"), (599, "ROPAR"), (702, "PUNJAB")]),
    (68, [(265, "KURALI")]),  # wrapped address line
    (80, [(30, "133992"), (58, "PH/6475/2023"), (141, "ASHU"), (265, "VILL."), (283, "LAPON"),
          (497, "JAGADHARI"), (599, "YAMUNANAGAR"), (702, "HARYANA")]),
    (92, [(49, "204"), (58, "P/7-(SEN)/1964"), (141, "AJIT"), (167, "SINGH"), (265, "19"),
          (497, "High"), (516, "Court"), (599, "CHANDIGARH"), (702, "CHANDIGARH")]),
)

INVALID_PAGE = _words(
    (40, [(36, "Sr.No"), (62, "EnrollmentNo"), (140, "Name"), (284, "Name"), (308, "as"), (434, "Member"), (466, "Status")]),
    (52, [(44, "78."), (62, "PH/2327/2019"), (140, "Amit"), (161, "Kumar"), (284, "AMIT"), (308, "KUMAR"), (434, "Suspended")]),
    (64, [(39, "271."), (62, "P/1669/2008"), (140, "Manoj"), (167, "Bishnoi"), (284, "RACHHPAL"), (335, "CHAND"), (434, "Dead")]),
    (76, [(39, "300."), (62, "PH/55/2015"), (140, "Ravi"), (284, "RAVI"), (434, "Transfered")]),
    (90, [(520, "Page"), (544, "1"), (551, "of"), (561, "1")]),
)

UPLOADED_PAGE = _words(
    (40, [(20, "Sr.No."), (53, "Name"), (191, "FatherName"), (329, "Enrolment"), (374, "No"), (437, "Address"),
          (629, "MobileNo"), (725, "AIBE")]),
    (52, [(34, "4."), (53, "Akanksh"), (329, "PH/7603/2022"), (437, "BASANT"), (629, "85580-19791")]),
    (64, [(34, "9."), (53, "Himani"), (90, "Choudhary"), (120, "D/O"), (140, "JOGINDER"), (191, "JOGINDER"),
          (329, "PH/1824/2024"), (437, "VPO"), (629, "98000-00000")]),
    (90, [(520, "Page"), (544, "1"), (551, "of"), (561, "1")]),
)


def test_roll_rows_keep_name_and_place_and_join_wrapped_lines() -> None:
    rows = ph.parse_page_rows(ROLL_PAGE, ph.ROLL_COLUMNS)
    assert [r["enrollment"] for r in rows] == ["P/1150/1993", "PH/6475/2023", "P/7-(SEN)/1964"]
    assert rows[0]["name"] == "MANDEEP KAUR" and rows[0]["address"].endswith("KURALI")
    assert (rows[1]["station"], rows[1]["district"], rows[1]["state"]) == ("JAGADHARI", "YAMUNANAGAR", "HARYANA")


@pytest.mark.parametrize(
    ("raw", "canonical"),
    [("ph-1234-2020", "PH/1234/2020"), ("PH 1234 2020", "PH/1234/2020"), (" p/ 5 /1956", "P/5/1956"),
     ("P/52-A/1949", "P/52-A/1949"), ("p/7-(sen)/1964", "P/7-(SEN)/1964")],
)
def test_enrolment_numbers_are_normalised(raw: str, canonical: str) -> None:
    assert ph.normalize_enrollment(raw) == canonical and ph.is_bcph_enrollment(raw)


@pytest.mark.parametrize(
    ("raw", "clean"),
    [("HIMANI CHOUDHARY D/O JOGINDER KUMAR", "HIMANI CHOUDHARY"), ("RAMANS/O B B MITTAL", "RAMAN"),
     ("ASHOK KUMAR son of RAM CHAND", "ASHOK KUMAR"), ("SUDHA  RANI", "SUDHA RANI"), ("SODHI SINGH", "SODHI SINGH")],
)
def test_relation_and_fathers_name_are_never_stored(raw: str, clean: str) -> None:
    assert ph.clean_name(raw) == clean


def test_other_councils_numbers_are_not_bcph() -> None:
    assert not ph.is_bcph_enrollment("UP1234/2010") and not ph.is_bcph_enrollment("D/123/2015")


@pytest.fixture()
def index(tmp_path):
    b = ph.IndexBuilder()
    b.add_roll_rows(ph.parse_page_rows(ROLL_PAGE, ph.ROLL_COLUMNS))
    b.add_voter_rows(ph.parse_page_rows(UPLOADED_PAGE, ph.VOTERS_UPLOADED_COLUMNS), "Abohar")
    b.add_invalid_rows(ph.parse_page_rows(INVALID_PAGE, ph.VOTERS_INVALID_COLUMNS), "Abohar")
    path = str(tmp_path / "ph.sqlite")
    b.write(path, {"built_at": "2026-10-12T00:00:00+00:00"})
    return ph.RollIndex(path)


def test_index_keeps_only_verification_fields(index) -> None:
    row = index.lookup("PH/1824/2024")  # only on a 2026 voter list
    assert row["name"] == "Himani Choudhary" and row["place_of_practice"] == "Abohar"
    assert set(row) == {"enrollment_no", "name", "place_of_practice", "district", "state", "status", "status_raw", "sources"}
    assert "98000" not in str(row) and "JOGINDER" not in str(row)  # no phone or father's name


def test_invalid_list_status_is_recorded_with_bcph_record_name(index) -> None:
    assert index.lookup("PH/2327/2019")["status"] == ph.SUSPENDED
    dead = index.lookup("P/1669/2008")
    assert dead["status"] == ph.DECEASED and dead["name"] == "RACHHPAL CHAND"


def _verify(index, number):
    return asyncio.run(PunjabHaryanaVerifier(index).verify(number))


def test_footer_and_unknown_remarks_go_to_review(index) -> None:
    moved = index.lookup("PH/55/2015")
    assert moved["status"] == ph.FLAGGED and moved["status_raw"] == "Transfered"  # no "Page 1 of 1"
    result = _verify(index, "PH/55/2015")
    assert result["status"] == "not_found" and "Transfered" in result["message"]


def test_verifier_outcomes(index) -> None:
    ok = _verify(index, "p/1150/1993")
    assert ok["status"] == "success"
    assert ok["data"]["name"] == "MANDEEP KAUR" and ok["data"]["state"] == "Punjab"
    assert _verify(index, "PH/2327/2019")["status"] == "failed"  # suspended
    assert _verify(index, "P/1669/2008")["status"] == "failed"  # deceased
    missing = _verify(index, "PH/9999/2026")
    assert missing["status"] == "not_found"  # recent enrolment → a person checks
    assert _verify(index, "UP1234/2010")["status"] == "failed"  # wrong format


def test_missing_index_is_an_error_not_a_rejection(tmp_path) -> None:
    result = asyncio.run(PunjabHaryanaVerifier(ph.RollIndex(str(tmp_path / "none.sqlite"))).verify("P/1/2000"))
    assert result["status"] == "error"


def test_voter_list_links_and_bar_association_names() -> None:
    html = '<a href="https://bcph.co.in/x/ABOHAR_VoterListUploaded.pdf">a</a> <a href="https://bcph.co.in/x/ABOHAR_VoterListInvalid.pdf">b</a>' \
           ' <a href="https://bcph.co.in/x/ABOHAR_VoterListMultipleVote.pdf">c</a> <a href="https://bcph.co.in/x/SRI.-MUKATSAR-SAHIB_VoterListUploaded.pdf">d</a>'
    uploaded, invalid = ph.voter_list_links(html)
    assert len(uploaded) == 2 and len(invalid) == 1
    assert ph.bar_association_of(uploaded[1]) == "Sri. Mukatsar Sahib"


@pytest.mark.parametrize("state", ["Punjab", "haryana", "Chandigarh", "Punjab & Haryana", "PH"])
def test_all_three_states_use_the_one_council(state: str) -> None:
    from app.services.verification_service import BAR_COUNCILS, supported_states

    assert any(state.lower() in aliases for verifier, aliases in BAR_COUNCILS.values() if verifier is PunjabHaryanaVerifier)
    assert "Punjab & Haryana" in supported_states() and len(supported_states()) == 5
