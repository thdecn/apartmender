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
  \mark \markup { \box \bold "m. 45" }
  c'''4-3_>
bes''8\trill\>
a''16
bes''16
a''4)\!
r4
  d''8^\finger "(1)"\p\< s1*1/8
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  e'8-5
c''8-1
g'8-3
c''8
f'8-4
c''8-1
a'8-2
c''8
  bes'4_\finger "(2)"
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
