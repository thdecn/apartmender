\version "2.26.0"
#(set-global-staff-size 25)

\paper {
  indent = 0\mm
  top-margin = 4\mm
  bottom-margin = 4\mm
  left-margin = 4\mm
  right-margin = 4\mm
  paper-width = 150\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \mark \markup { \box \bold "m. 70" }
  \override PhrasingSlur.direction = #-1

\acciaccatura e''8-3
\afterGrace 15/16 d''1\startTrillSpan\(( { c''16[ d''16])\stopTrillSpan }
  \override PhrasingSlur.direction = #1

c''4^\finger "(2)"-.
  \bar "|."
}

lowerCard = {
  g16_\finger "(5)"
f'16
b16
f'16
g16
f'16
b16
f'16
g16
f'16
b16
f'16
g16
f'16
b16
f'16
  < c'-2 e'-1 >4-.
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \with { clefGlyph = "clefs.G" clefPosition = #-2 middleCClefPosition = #-6 middleCPosition = #-6 timeSignature = #'(4 . 4) keyAlterations = #'() } \upperCard
    \new Staff = "lower" \with { clefGlyph = "clefs.F" clefPosition = #2 middleCClefPosition = #6 middleCPosition = #6 timeSignature = #'(4 . 4) keyAlterations = #'() } \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
