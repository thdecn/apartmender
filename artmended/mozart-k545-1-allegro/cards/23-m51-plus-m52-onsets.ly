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
  \mark \markup { \box \bold "m. 51" }
  < c'' g''-4 >4^\finger "(1)"-.
r4
r4
< c'' g''-5 >4-.
  < c'' f''-4 >4^\finger "(2)"-.
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  e8_\finger "(5)"
f16
g16
a16
b16-4
c'16
d'16
e'16
d'16
c'16
b16
a16-1
g16
f16
e16
  d8_\finger "(5)" s1*1/8
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
