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
  \mark \markup { \box \bold "m. 32" }
  cis''4^\finger "(2)"-.\sf
r4
r16
cis'''16-3(
e'''16
d'''16
cis'''16
bes''16
a''16
g''16-3
  f''4^\finger "(1)"\sf)
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  r16
a16_5(
b16
c'16
d'16
e'16
fis'16-3
gis'16
a'4-.\sf)
r4
  < d, d >4_\finger "(51)"
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
