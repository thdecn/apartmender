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
  \mark \markup { \box \bold "m. 8" }
  e'8^\finger "(1)"\<
f'16
g'16
a'16-1
b'16
c''16
d''16\!
e''16\>
d''16
c''16
b'16
a'16
\tag #'first g'16-4
f'16
e'16\!\)
  d'8^\finger "(1)"\p s1*7/8
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  < c c' >4_\finger "(51)"-.
r4
r4
< c-5 e-3 >4-.
  < f-2 a-1 >1
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
