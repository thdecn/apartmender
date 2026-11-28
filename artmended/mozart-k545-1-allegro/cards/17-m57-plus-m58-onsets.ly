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
  \clef treble
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 57" }
  d''4^\finger "(2)"-.
< b' d'' g'' >4-.
g'4-.-2
r4
  r1
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  g,4_\finger "(5)"-.\)
g4-.
g,4-.
r4
  \clef "treble"

fis'16->\p-2 s1*15/16
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
