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
  \mark \markup { \box \bold "m. 40" }
  r16
e''16-1(
b''16-5
a''16
gis''16
f''16
e''16
d''16-3
c''4-.\sf)
r4
  \break
r16
bes'16-3 s1*3/8
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  \clef "bass"

gis4_\finger "(4)"-.\sf)
r4
r16
a16-3(
c'16-1
b16
a16
g16-1
f16
e16
  d2_\finger "(4)"\sf)
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
