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
  \mark \markup { \box \bold "m. 35" }
  r16
d'16-1(
e'16
f'16
g'16-1
a'16
b'16
cis''16
d''4-.\sf)
r4
  r16
b'16-1 s1*1/8
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  < d_5 f_4 >4-.)
r4
r16
d'16-3(
f'16
e'16
d'16
c'16-1
b16
a16
  gis4_\finger "(4)"-.)\sf
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
