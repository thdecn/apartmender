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
  \mark \markup { \box \bold "m. 34" }
  d''4^\finger "(3)"-.)
d'16-2
a16
d'16
f'16-4
a'16
f'16
d'16-2
f'16
g'16-5
e'16-3
cis'16
e'16
  r16
d'16-1 s1*1/8
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  < d'-3 f'-1 >4-.)
r4
r4
\clef "bass"

< a, e g >4(
  < d_5 f_4 >4-.)
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
