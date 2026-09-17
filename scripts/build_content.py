#!/usr/bin/env python3
"""Build Day4 Speak content JSON + audio index for Basic A/B/C."""
from __future__ import annotations
import json, re, shutil, hashlib
from pathlib import Path

ROOT = Path("/workspace/day4-speak")
CONTENT = ROOT / "content"
AUDIO = ROOT / "audio"
CONTENT.mkdir(parents=True, exist_ok=True)
AUDIO.mkdir(parents=True, exist_ok=True)

DAY5_AUDIO = Path("/workspace/day5-practice/audio")
DAY6_AUDIO = Path("/workspace/conv-youtube/day6-audio")
AUDIO_SPEC = Path("/workspace/conv-youtube/day5-packs/AUDIO_SPEC.json")
DAY6_MANIFEST = Path("/workspace/conv-youtube/day6-audio/MANIFEST.json")

def norm(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"^\[.*?\]\s*", "", s)  # strip emotion tags
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"[^\w\s']+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ---- Full Day4 catalog: book -> units -> items (korean, english, alts) ----
CATALOG = {
  "basic_a": {
    "label": "Basic A",
    "units": [
      {
        "id": "unit01", "title": "Numbers 1 to 10",
        "items": [
          ("일", "one"), ("이", "two"), ("삼", "three"), ("사", "four"), ("오", "five"),
          ("육", "six"), ("칠", "seven"), ("팔", "eight"), ("구", "nine"), ("십", "ten"),
        ]
      },
      {
        "id": "unit02", "title": "Hello",
        "items": [
          ("안녕하세요, Mr.고양이", "Hello, Mr. Cat"),
          ("안녕하세요, Mr.개", "Hello, Mr. Dog"),
          ("안녕하세요, Mr.소", "Hello, Mr. Cow"),
          ("안녕하세요, Mr.말", "Hello, Mr. Horse"),
          ("안녕하세요, Ms.닭", "Hello, Ms. Chicken"),
          ("안녕하세요, Ms.염소", "Hello, Ms. Goat"),
          ("안녕하세요, Ms.돼지", "Hello, Ms. Pig"),
          ("안녕하세요, Mrs.양", "Hello, Mrs. Sheep"),
          ("안녕하세요, Mrs.오리", "Hello, Mrs. Duck"),
          ("안녕하세요, Mrs.거미", "Hello, Mrs. Spider"),
        ]
      },
      {
        "id": "unit03", "title": "Computer Orders",
        "items": [
          ("헤드셋을 뽑아라", "Unplug your headset"),
          ("스크롤을 내려라", "Scroll down"),
          ("네 ID를 쳐라", "Type your ID"),
          ("새 탭을 만들어라", "Make a new tab"),
          ("왼쪽 클릭", "Left click"),
          ("오른쪽 클릭", "Right click"),
          ("연속 클릭", "Double click"),
          ("X를 클릭하지마라", "Don't click on X"),
          ("네 컴퓨터를 다시 켜라", "Restart your computer"),
        ]
      },
      {
        "id": "unit04", "title": "Classroom English One",
        "items": [
          ("안녕하세요(오후 인사)", "Good afternoon"),
          ("내일 봐요", "See you tomorrow"),
          ("미안해요", "Sorry"),
          ("뭐라고요?", "Pardon?"),
          ("도와주세요", "Help me please"),
          ("조용히해!", "Quiet!"),
          ("기다려!", "Wait!"),
        ]
      },
      {
        "id": "unit05", "title": "Family",
        "items": [
          ("이 분은 제 엄마입니다", "This is my mom"),
          ("이 분은 제 아빠입니다", "This is my dad"),
          ("이 사람은 제 누나(여동생)입니다", "This is my sister"),
          ("이 사람은 제 형(남동생)입니다", "This is my brother"),
          ("이 분은 제 삼촌입니다", "This is my uncle"),
          ("이 분은 제 숙모입니다", "This is my aunt"),
          ("이 분은 제 할머니입니다", "This is my grandmother"),
          ("이 사람은 제 사촌입니다", "This is my cousin"),
          ("이 사람은 제 조카입니다", "This is my nephew"),
          ("이 사람은 제 손자입니다", "This is my grandson"),
        ]
      },
      {
        "id": "unit06", "title": "What is this?",
        "items": [
          ("책상입니다", "It is a desk"),
          ("짐 볼입니다", "It is a gym ball"),
          ("마우스입니다", "It is a mouse"),
          ("키보드입니다", "It is a keyboard"),
          ("모니터입니다", "It is a monitor"),
          ("헤드셋입니다", "It is a headset"),
          ("큐브입니다", "It is a cube"),
          ("클립보드입니다", "It is a clipboard"),
          ("펜입니다", "It is a pen"),
          ("책입니다", "It is a book"),
        ]
      },
      {
        "id": "unit07", "title": "I can",
        "items": [
          ("나는 춤을 출 수 있다", "I can dance"),
          ("나는 빠르게 달릴 수 있다", "I can run fast"),
          ("나는 노래를 할 수 있다", "I can sing"),
          ("나는 태권도를 할 수 있다", "I can do taekwondo"),
          ("나는 피아노를 칠 수 있다", "I can play the piano"),
          ("나는 그릴 수 있다", "I can draw"),
          ("나는 중국어를 할 수 있다", "I can speak Chinese"),
          ("나는 마술을 할 수 있다", "I can do magic"),
          ("나는 공부를 할 수 있다", "I can study"),
          ("나는 먹을 수 있다", "I can eat"),
        ]
      },
      {
        "id": "unit08", "title": "Numbers 11–100",
        "items": [
          ("100", "one hundred", ["a hundred", "hundred", "100"]),
          ("99", "ninety-nine", ["99", "ninety nine"]),
          ("97", "ninety-seven", ["97", "ninety seven"]),
          ("55", "fifty-five", ["55", "fifty five"]),
          ("33", "thirty-three", ["33", "thirty three"]),
          ("22", "twenty-two", ["22", "twenty two"]),
          ("15", "fifteen", ["15"]),
          ("13", "thirteen", ["13"]),
          ("12", "twelve", ["12"]),
          ("11", "eleven", ["11"]),
        ]
      },
    ]
  },
  "basic_b": {
    "label": "Basic B",
    "units": [
      {
        "id": "unit01", "title": "How are you?",
        "items": [
          ("나는 행복해", "I am happy"),
          ("나는 슬퍼", "I am sad"),
          ("나는 화나", "I am angry"),
          ("나는 배고파", "I am hungry"),
          ("나는 힘들어", "I am tired"),
          ("나는 지루해", "I am bored"),
          ("나는 무서워", "I am scared"),
          ("나는 아파", "I am sick"),
          ("나는 걱정돼", "I am worried"),
          ("나는 졸려", "I am sleepy"),
        ]
      },
      {
        "id": "unit02", "title": "I like Mr. Jay",
        "items": [
          ("나는 면을 좋아해", "I like noodles"),
          ("나는 고기를 좋아해", "I like meat"),
          ("나는 과일을 좋아해", "I like fruit"),
          ("나는 게임을 좋아해", "I like games"),
          ("나는 학교를 좋아해", "I like school"),
          ("나는 운동을 좋아해", "I like exercise"),
          ("나는 영화를 좋아해", "I like movies"),
          ("나는 음악을 좋아해", "I like music"),
          ("나는 너를 좋아해", "I like you"),
          ("나는 사과를 좋아해", "I like apples"),
        ]
      },
      {
        "id": "unit03", "title": "Classroom English Two",
        "items": [
          ("다시!", "Again!"),
          ("이걸 재활용해!", "Recycle this!"),
          ("이걸 버려!", "Trash this!"),
          ("그거 하지마!", "Don't do that!"),
          ("고마워", "Thank you"),
          ("실례합니다", "Excuse me"),
          ("저는 이해가 안됩니다", "I do not understand"),
          ("저는 모르겠습니다", "I do not know"),
          ("도와주세요", "Help me please"),
          ("조용히해!", "Quiet!"),
        ]
      },
      {
        "id": "unit04", "title": "Rock Paper Scissors",
        "items": [
          ("바위가 이겼다", "Rock wins", ["rock", "I win"]),
          ("보가 이겼다", "Paper wins", ["paper", "I win"]),
          ("가위가 이겼다", "Scissors wins", ["scissors", "I win"]),
          ("바위가 이겼다", "Rock wins", ["rock", "I win"]),
          ("보가 이겼다", "Paper wins", ["paper", "I win"]),
          ("가위가 이겼다", "Scissors wins", ["scissors", "I win"]),
          ("바위가 이겼다", "Rock wins", ["rock", "I win"]),
          ("보가 이겼다", "Paper wins", ["paper", "I win"]),
          ("가위가 이겼다", "Scissors wins", ["scissors", "I win"]),
          ("바위가 이겼다", "Rock wins", ["rock", "I win"]),
        ]
      },
      {
        "id": "unit05", "title": "What is it?",
        "items": [
          ("책이야", "It is a book"),
          ("휴대폰 충전기였다", "It was a phone charger", ["It is a phone charger"]),
          ("양말이었다", "It was a sock", ["It is a sock"]),
          ("장난감이야", "It is a toy"),
          ("속옷이야", "It is underwear"),
          ("칫솔이었다", "It was a toothbrush", ["It is a toothbrush"]),
          ("야간등이야", "It is a night light"),
          ("곰인형이었다", "It was a teddy bear", ["It is a teddy bear"]),
          ("사과였다", "It was an apple"),
          ("가방이야", "It is a bag"),
        ]
      },
      {
        "id": "unit06", "title": "I like my body",
        "items": [
          ("이것은 내 머리입니다", "This is my head"),
          ("이것은 내 코입니다", "This is my nose"),
          ("이것은 내 입입니다", "This is my mouth"),
          ("이것은 내 귀입니다", "This is my ear"),
          ("이것은 내 눈입니다", "This is my eye"),
          ("이것은 내 목입니다", "This is my neck"),
          ("이것은 내 몸입니다", "This is my body"),
          ("이것은 내 턱입니다", "This is my chin"),
          ("이것은 내 손입니다", "This is my hand"),
          ("이것은 내 어깨입니다", "This is my shoulder"),
        ]
      },
      {
        "id": "unit07", "title": "What Color is That?",
        "items": [
          ("하얀색이야", "It is white"),
          ("검은색이야", "It is black"),
          ("갈색이야", "It is brown"),
          ("빨간색이야", "It is red"),
          ("주황색이야", "It is orange"),
          ("노랑색이야", "It is yellow"),
          ("초록색이야", "It is green"),
          ("파란색이야", "It is blue"),
          ("보라색이야", "It is purple"),
          ("다색이야", "It is a rainbow", ["It is rainbow", "rainbow"]),
        ]
      },
      {
        "id": "unit08", "title": "How old are you?",
        "items": [
          ("나는 7살입니다", "I am seven years old", ["I am 7", "I am seven"]),
          ("나는 10살입니다", "I am ten years old", ["I am 10", "I am ten"]),
          ("나는 14살입니다", "I am fourteen years old", ["I am 14", "I am fourteen"]),
          ("나는 17살입니다", "I am seventeen years old", ["I am 17", "I am seventeen"]),
          ("나는 22살입니다", "I am twenty-two years old", ["I am 22", "I am twenty two"]),
          ("나는 25살입니다", "I am twenty-five years old", ["I am 25", "I am twenty five"]),
          ("나는 33살입니다", "I am thirty-three years old", ["I am 33", "I am thirty three"]),
          ("나는 66살입니다", "I am sixty-six years old", ["I am 66", "I am sixty six"]),
          ("나는 1살입니다", "I am one year old", ["I am 1", "I am one"]),
          ("나는 100살입니다", "I am one hundred years old", ["I am 100", "I am a hundred"]),
        ]
      },
    ]
  },
  "basic_c": {
    "label": "Basic C",
    "units": [
      {
        "id": "unit01", "title": "I Love My Dog Zoey",
        "items": [
          ("나는 내 개 'Zoey'를 사랑해", "I love my dog Zoey"),
          ("나는 내 고양이 'Leo'를 사랑해", "I love my cat Leo"),
          ("나는 내 새 'Sarah'를 사랑해", "I love my bird Sarah"),
          ("나는 내 토끼 'Sam'을 사랑해", "I love my rabbit Sam"),
          ("나는 내 햄스터 'Fluffy'를 사랑해", "I love my hamster Fluffy"),
          ("나는 내 물고기 'Nimo'를 사랑해", "I love my fish Nimo"),
          ("나는 내 풍뎅이 'Bob'을 사랑해", "I love my beetle Bob"),
          ("나는 내 거북이 'Tom'을 사랑해", "I love my turtle Tom"),
          ("나는 내 뱀 'Jessica'를 사랑해", "I love my snake Jessica"),
          ("나는 내 다람쥐 'Sandy'를 사랑해", "I love my squirrel Sandy"),
        ]
      },
      {
        "id": "unit02", "title": "Look at My New Hat",
        "items": [
          ("나의 새 모자를 봐", "Look at my new hat"),
          ("나의 새 이어폰을 봐", "Look at my new earphones"),
          ("나의 새 신발을 봐", "Look at my new shoes"),
          ("나의 새 휴대폰을 봐", "Look at my new phone"),
          ("나의 새 외투를 봐", "Look at my new coat"),
          ("나의 새 시계를 봐", "Look at my new watch", ["Look at my watch"]),
          ("나의 새 가방을 봐", "Look at my new bag"),
          ("나의 새 컴퓨터를 봐", "Look at my new computer"),
          ("나의 새 장갑을 봐", "Look at my new gloves"),
          ("나의 새 집을 봐", "Look at my new house"),
        ]
      },
      {
        "id": "unit03", "title": "Classroom English Three",
        "items": [
          ("월요일에 봐요", "See you Monday"),
          ("시작해도 되나요?", "May I start?"),
          ("보고해라!", "Report!"),
          ("cat의 철자를 말해라!", "Spell cat!"),
          ("cat이 무슨 뜻인가요?", "What does cat mean?"),
          ("천만에요", "You are welcome"),
          ("절 시험 해 주세요", "Please test me"),
          ("내일 봐요", "See you tomorrow"),
          ("저는 이해가 안됩니다", "I do not understand"),
          ("저는 모르겠습니다", "I do not know"),
        ]
      },
      {
        "id": "unit04", "title": "What Can We See near Tongyeong?",
        "items": [
          ("서울", "What can we see near Seoul?"),
          ("부산", "What can we see near Busan?"),
          ("제주", "What can we see near Jeju?", ["What can we see near Jeh joo?"]),
          ("통영", "What can we see near Tongyeong?", ["What can we see near Tong young?"]),
          ("공주", "What can we see near Gongju?"),
          ("안동", "What can we see near Andong?", ["What can we see near Ahndong?"]),
          ("순천", "What can we see near Suncheon?"),
          ("고성", "What can we see near Goseong?"),
          ("평창", "What can we see near Pyeongchang?"),
          ("진도", "What can we see near Jindo?"),
        ]
      },
      {
        "id": "unit05", "title": "Spelling Bee",
        "items": [
          ("돼지", "pig", ["Spell pig", "P I G"]),
          ("개", "dog", ["Spell dog", "D O G"]),
          ("고양이", "cat", ["Spell cat", "C A T"]),
          ("서울", "Seoul", ["Spell Seoul", "S E O U L"]),
          ("통영", "Tongyeong", ["Spell Tongyeong", "T O N G Y E O N G"]),
          ("캐나다", "Canada", ["Spell Canada"]),
          ("학교", "school", ["Spell school"]),
          ("그네", "swing", ["Spell swing"]),
          ("무릎", "knee", ["Spell knee"]),
          ("얼굴", "face", ["Spell face"]),
        ]
      },
      {
        "id": "unit06", "title": "Don't Touch Your Arm",
        "items": [
          ("당신의 팔을 만지지 마세요", "Don't touch your arm"),
          ("당신의 다리를 만지지 마세요", "Don't touch your leg"),
          ("당신의 무릎을 만지지 마세요", "Don't touch your knee"),
          ("당신의 등을 만지지 마세요", "Don't touch your back"),
          ("당신의 얼굴을 만지지 마세요", "Don't touch your face"),
          ("당신의 배를 만지지 마세요", "Don't touch your stomach"),
          ("당신의 손목을 만지지 마세요", "Don't touch your wrist"),
          ("당신의 발가락을 만지지 마세요", "Don't touch your toe", ["Don't touch your toes"]),
          ("당신의 목을 만지지 마세요", "Don't touch your neck"),
          ("당신의 귀를 만지지 마세요", "Don't touch your ear", ["Don't touch your ears"]),
        ]
      },
      {
        "id": "unit07", "title": "Come Play With Us",
        "items": [
          ("미끄럼틀은 어디에 있어?", "Where is the slide?"),
          ("시소는 어디에 있어?", "Where is the seesaw?"),
          ("회전목마는 어디에 있어?", "Where is the merry-go-round?"),
          ("그네는 어디에 있어?", "Where is the swing?"),
          ("정글짐은 어디에 있어?", "Where is the jungle gym?"),
          ("모래사장은 어디에 있어?", "Where is the sandbox?"),
          ("놀이터는 어디에 있어?", "Where is the playhouse?", ["Where is the playground?"]),
          ("범퍼카는 어디에 있어?", "Where is the bumper car?"),
          ("미로는 어디에 있어?", "Where is the maze?"),
          ("롤러코스터는 어디에 있어?", "Where is the roller coaster?"),
        ]
      },
      {
        "id": "unit08", "title": "I Want a New Computer",
        "items": [
          ("나는 새 인형을 원해", "I want a new doll"),
          ("나는 새 필통을 원해", "I want a new pencil case"),
          ("나는 새 책가방을 원해", "I want a new school bag"),
          ("나는 새 이어폰을 원해", "I want new earphones", ["I want a new earphones"]),
          ("나는 새 휴대폰을 원해", "I want a new phone"),
          ("나는 새 옷을 원해", "I want new clothes"),
          ("나는 새 자전거를 원해", "I want a new bike"),
          ("나는 새 컴퓨터를 원해", "I want a new computer"),
          ("나는 새 남동생을 원해", "I want a new brother"),
          ("나는 새 집을 원해", "I want a new house"),
        ]
      },
    ]
  },
}

def build_audio_index():
    """Map normalized English text -> source mp3 path. Prefer kid/stu, then listen, then word, then day6 student."""
    index = {}  # norm -> (path, source_tag, priority)
    # lower priority number = better
    def add(text, path, tag, pri):
        if not path or not Path(path).is_file():
            return
        key = norm(text)
        if not key:
            return
        cur = index.get(key)
        if cur is None or pri < cur[2]:
            index[key] = (str(path), tag, pri)

    # AUDIO_SPEC from day5
    if AUDIO_SPEC.is_file():
        spec = json.loads(AUDIO_SPEC.read_text())
        for _k, v in spec.items():
            fn = v.get("filename")
            text = v.get("text", "")
            role = v.get("voice_role", "")
            path = DAY5_AUDIO / fn if fn else None
            if role == "kid" or "_stu_" in (fn or ""):
                pri = 1
                tag = "day5-stu"
            elif "_listen_" in (fn or ""):
                pri = 2
                tag = "day5-listen"
            elif "_word_" in (fn or ""):
                pri = 3
                tag = "day5-word"
            else:
                pri = 4
                tag = "day5-other"
            add(text, path, tag, pri)

    # Also index by filename stem heuristic for word files present on disk
    if DAY5_AUDIO.is_dir():
        for p in DAY5_AUDIO.glob("*_aud_word_*.mp3"):
            # ba_u01_aud_word_one.mp3 -> one
            m = re.search(r"_aud_word_(.+)\.mp3$", p.name)
            if m:
                word = m.group(1).replace("_", " ")
                add(word, p, "day5-word-fn", 3)
        for p in DAY5_AUDIO.glob("*_aud_listen_*.mp3"):
            m = re.search(r"_aud_listen_(.+)\.mp3$", p.name)
            if m:
                word = m.group(1).replace("_", " ")
                add(word, p, "day5-listen-fn", 2)

    # Day6 student lines
    if DAY6_MANIFEST.is_file():
        man = json.loads(DAY6_MANIFEST.read_text())
        for it in man.get("items", []):
            if not it.get("ok"):
                continue
            stu = it.get("student") or ""
            path = DAY6_AUDIO / it["path"]
            add(stu, path, "day6-student", 0)  # prefer day6 student target lines

    return index

def slug(s: str) -> str:
    s = re.sub(r"[^\w]+", "_", s.lower()).strip("_")
    return s[:60] or "x"

def main():
    index = build_audio_index()
    print(f"Audio index keys: {len(index)}")

    manifest = {"books": [], "pass_score": 80, "scoring": "webspeech-levenshtein", "version": 1}
    stats = {"books": 0, "units": 0, "items": 0, "audio_reuse": 0, "audio_missing": 0, "by_source": {}}
    missing = []

    for book_id, book in CATALOG.items():
        book_out = {"id": book_id, "label": book["label"], "units": []}
        stats["books"] += 1
        for unit in book["units"]:
            stats["units"] += 1
            unit_items = []
            for i, row in enumerate(unit["items"], 1):
                if len(row) == 2:
                    ko, en = row
                    alts = []
                else:
                    ko, en, alts = row
                stats["items"] += 1
                key = norm(en)
                hit = index.get(key)
                # try alts
                if not hit:
                    for a in alts:
                        hit = index.get(norm(a))
                        if hit:
                            break
                # try stripped "it is a X" -> X for word audio
                if not hit:
                    m = re.match(r"^(?:it is an?|this is my|i am|i like|i can|i love my|i want (?:a |an |new )?|look at my (?:new )?|don't touch your|where is the)\s+(.+)$", key)
                    if m:
                        hit = index.get(norm(m.group(1)))
                audio_rel = None
                audio_source = None
                if hit:
                    src_path, tag, _pri = hit
                    # copy into our audio folder with stable name
                    dest_name = f"{book_id}_{unit['id']}_{i:02d}_{slug(en)}.mp3"
                    dest = AUDIO / dest_name
                    if not dest.exists() or dest.stat().st_size == 0:
                        shutil.copy2(src_path, dest)
                    audio_rel = f"audio/{dest_name}"
                    audio_source = tag
                    stats["audio_reuse"] += 1
                    stats["by_source"][tag] = stats["by_source"].get(tag, 0) + 1
                else:
                    stats["audio_missing"] += 1
                    missing.append({"book": book_id, "unit": unit["id"], "n": i, "english": en, "korean": ko})
                    # placeholder path for later bake
                    dest_name = f"{book_id}_{unit['id']}_{i:02d}_{slug(en)}.mp3"
                    audio_rel = f"audio/{dest_name}"
                    audio_source = "missing"

                unit_items.append({
                    "id": f"{book_id}-{unit['id']}-{i:02d}",
                    "n": i,
                    "korean": ko,
                    "english": en,
                    "alts": alts,
                    "audio": audio_rel,
                    "audio_source": audio_source,
                })
            unit_out = {"id": unit["id"], "title": unit["title"], "items": unit_items}
            book_out["units"].append(unit_out)
            # write per-unit file
            upath = CONTENT / book_id / f"{unit['id']}.json"
            upath.parent.mkdir(parents=True, exist_ok=True)
            upath.write_text(json.dumps(unit_out, ensure_ascii=False, indent=2), encoding="utf-8")
        # write book file
        (CONTENT / f"{book_id}.json").write_text(json.dumps(book_out, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest["books"].append({"id": book_id, "label": book["label"], "path": f"content/{book_id}.json", "units": len(book_out["units"]), "items": sum(len(u["items"]) for u in book_out["units"])})

    (CONTENT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "scripts" / "missing_audio.json").write_text(json.dumps(missing, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "scripts" / "build_stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=2))
    print(f"Missing audio: {len(missing)}")

if __name__ == "__main__":
    main()
