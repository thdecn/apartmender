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
  \mark \markup { \box \bold "m. 52" }
  < c'' f''-4 >4^\finger "(2)"-.
r4
r4
< b' f''-5 >4-.
  < c''-2 e''-4 >4-.
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  d8_\finger "(5)"
e16
f16
g16
a16
b16-3
c'16
d'16
c'16
b16
a16
g16-1
f16
e16
d16
  c8-5 s1*1/8
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
