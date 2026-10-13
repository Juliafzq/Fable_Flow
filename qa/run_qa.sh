#!/usr/bin/env bash
# Fable / Flow targeted QA gate.
# Run only the groups a change impacts, in parallel:
#   ./run_qa.sh typing edit          ./run_qa.sh bars          ./run_qa.sh all
# Groups:
#   bars    bottom-bar slots, sizes, row alignment
#   flip    flip buttons + swipe-to-flip (Today & past cards), stack edge scrolling, strikes kept after flip
#   edit    tap-to-edit opens reliably, stray blur, × delete, no reflow when editing
#   typing  Return -> next item, 8-item cap, shrink-to-fit, no size bounce while typing
#   profile profile menu: Language dropdown (no auto-switch), persists, menu size stable
#   timer   timers keep real time when hidden / asleep / reopened; end bell rings 3x, on time when hidden
#   assign  lit mini tomato opens its timer (no unassign); renamed timers keep upper/lower case
#   twist   hero tomato: top half (leaves, shoulders) turns with the dial; bottom/stem/backdrop still
#   about   About letter lines appear at a brisk, calm pace
#   layout  Chinese overflow audit on every screen & tutorial step (375 + 320 wide) — slowest
cd "$(dirname "$0")"
pkill -f -- "--user-data-dir=/tmp/zh_audit_profile" 2>/dev/null; sleep 0.5
rm -rf /tmp/zh_audit_profile_* 2>/dev/null

groups="$*"
[ -z "$groups" ] && { sed -n '2,15p' "$0"; exit 2; }
[ "$groups" = "all" ] && groups="bars flip edit typing profile timer assign twist about layout"

BASE=$((9400 + RANDOM % 300))
TMP=$(mktemp -d)
n=0
job() {  # name, mode(pass|json:<expr>), command...
  local name="$1" mode="$2"; shift 2
  n=$((n+1)); local id=$n port=$((BASE + n))
  while [ "$(jobs -rp | wc -l)" -ge 2 ]; do sleep 0.4; done
  sleep 0.5
  (
    out=$(timeout 150 "${@//PORT/$port}" 2>&1)
    if [ "$mode" = "pass" ]; then
      echo "$out" | tail -3 | grep -q "PASS" && echo "PASS  $name" > "$TMP/$id" || { echo "FAIL  $name"; echo "$out" | tail -12 | sed 's/^/      /'; } > "$TMP/$id"
    else
      expr="${mode#json:}"; last=$(echo "$out" | tail -1)
      python3 -c "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if ($expr) else 1)" "$last" 2>/dev/null \
        && echo "PASS  $name" > "$TMP/$id" || { echo "FAIL  $name"; echo "      $last"; } > "$TMP/$id"
    fi
  ) &
}

for g in $groups; do
  case $g in
    bars)   job "Bars: slots, sizes, alignment" pass python3 qa_bars.py PORT ;;
    flip)   job "Flip: buttons, swipe, interrupted swipe" pass python3 flip2_test.py 390 844 PORT
            job "Past cards: swipe flips, edges scroll"  pass python3 stack_test.py PORT
            job "Strikethroughs survive flipping"         pass python3 strike_flip_test.py PORT ;;
    edit)   job "Tap item -> edit opens (12 taps)"       pass python3 tap_edit_test.py 390 844 PORT
            job "Stray blur ignored, real blur saves"    pass python3 blur_test.py PORT
            job "× deletes item"                         pass python3 del_test.py PORT
            job "× deletes on first tap, no stray click"  pass python3 del_first_tap_test.py PORT
            job "Editing causes no reflow"               pass python3 reflow_test.py 375 667 PORT ;;
    typing) job "Return -> next item, 8 max, fits" \
              "json:d['finalCount']==8 and d['addRowHidden'] and d['bodyFits'] and d['editMovedToRowIdx']==2 and all(x['nextInputFocused'] for x in d['log'][:7])" \
              python3 enter_test.py 375 667 PORT
            for size in "375 667" "390 844"; do
              job "Typing: no size bounce (${size/ /x})" \
                "json:d['focusedImmediately'] and d['sizeIncreasesWhileTyping']==0 and d['afterCommit']==d['lastTypingSize']==d['afterRaf']" \
                python3 shrink_test.py $size PORT
            done ;;
    profile) job "Language dropdown: no auto-switch, persists" pass python3 lang_select_test.py PORT ;;
    timer)  job "Timer keeps time in background/sleep/reopen" pass python3 timer_background_test.py PORT
            job "End bell: 3 rings, on time when hidden, tap stops" pass python3 chime_test.py PORT ;;
    assign) job "Lit mini tomato opens its timer, no unassign" pass python3 mini_tap_test.py PORT
            job "Renamed timers keep upper/lower case"   pass python3 title_case_test.py PORT ;;
    twist)  job "Hero top half twists with the dial"     pass python3 twist_test.py PORT ;;
    about)  job "About letter: brisk, calm reveal"       pass python3 about_speed_test.py PORT ;;
    layout) job "Chinese overflow 375x667" pass python3 zh_audit_gate.py 375 667 PORT
            job "Chinese overflow 320x568" pass python3 zh_audit_gate.py 320 568 PORT ;;
    *) echo "unknown group: $g"; exit 2 ;;
  esac
done
start=$SECONDS
wait
cat $(ls "$TMP"/* | sort -V)
fails=$(grep -l "^FAIL" "$TMP"/* 2>/dev/null | wc -l)
rm -rf "$TMP"
echo
echo "($((SECONDS - start))s, groups: $groups)"
[ "$fails" -eq 0 ] && echo "QA PASSED" || { echo "QA FAILED — do not ship"; exit 1; }
