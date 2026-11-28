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
  \mark \markup { \box \bold "m. 30" }
  g''4^\finger "(3)"-.)
g'16-2_(
d'16
g'16
bes'16-3
d''16
bes'16-3
g'16
bes'16
c''16-5
a'16-3
fis'16-2
a'16-4
  g'4^\finger "(3)"-.)
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  < g'-3 bes'-1 >4)
r4
r4
\clef "bass"

< d a c' >4
  r16
g16_5 s1*1/8
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
