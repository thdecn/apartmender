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
  \mark \markup { \box \bold "m. 50" }
  a''4^\finger "(5)"-.
r4
r4
< c'' a''-5 >4-.
  < c'' g''-4 >4^\finger "(1)"-.
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  f8-5\(
g16
a16
bes16
c'16
d'16-3
e'16
f'16
e'16
d'16-1
c'16
bes16
a16-1
g16
f16
  e8_\finger "(5)" s1*1/8
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
