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
  \mark \markup { \box \bold "m. 37" }
  r16
a''16-1(
e'''16-5
d'''16
c'''16
b''16
a''16
g''16
f''4-.\sf)
r4
  r16
g''16-1 s1*1/8
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  c4_\finger "(4)"-.)\sf
r4
\clef "treble"

r16
d'16-5(
a'16-1
g'16
f'16
e'16-1
d'16
c'16
  \break
b4_\finger "(5)"-.\sf)
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
