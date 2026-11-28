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
  \mark \markup { \box \bold "m. 47" }
  c''8^\finger "(1)"\<
d''16
e''16
f''16-1
g''16
a''16
bes''16\!
c'''16\>
bes''16
a''16
g''16
f''16
\tag #'second e''16-3
d''16
c''16\!
  bes'8^\finger "(2)"\< s1*1/8
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  < a f' >4_\finger "(51)"-.
r4
r4
< a f' >4_4-.
  < g f' >4_\finger "(51)"-.
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
