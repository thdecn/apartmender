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
  \mark \markup { \box \bold "m. 31" }
  g'4^\finger "(3)"-.)
r4
r16
g''16-2
bes''16-4
a''16
g''16
f''16
e''16-4
d''16
  cis''4^\finger "(2)"-.\sf
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  r16
g16_5(
a16
bes16
c'16
d'16
e'16-3
fis'16
g'4-.\sf)
r4
  r16
a16_5 s1*1/8
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
