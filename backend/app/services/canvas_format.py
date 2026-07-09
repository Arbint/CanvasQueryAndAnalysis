def extract_instructor(raw_course: dict) -> str:
    teachers = raw_course.get("teachers", [])
    if teachers:
        return teachers[0].get("display_name", "Unknown")
    return "Unknown"


def extract_term_name(raw_course: dict) -> str:
    term = raw_course.get("term", {})
    return term.get("name", "Unknown") if term else "Unknown"
