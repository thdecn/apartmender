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
  \mark \markup { \box \bold "m. 4" }
  g''4-3_>
f''8\trill\>
e''16
f''16
e''4)\!
r4
  a'8^\finger "(1)"\p\< s1*1/8
  \bar "|."
}

lowerCard = {
  \clef treble
  \key c \major
  \time 4/4
  b8-5
g'8-1
d'8-3
g'8
c'8-4
g'8-1
e'8-2
g'8
  f'4_\finger "(2)"
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
